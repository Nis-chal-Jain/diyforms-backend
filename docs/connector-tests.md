# Connector token verification

Run against a local server. On Windows PowerShell, use `curl.exe` instead of `curl`.

```bash
# --- config ---
BASE_URL="${BASE_URL:-http://localhost:8080}"
API="$BASE_URL/api/v1"

# JWT from a verified free-plan user (cookie or login response)
JWT="${JWT:?set JWT to a valid access token}"

AUTH_JWT="Authorization: Bearer $JWT"
JSON="Content-Type: application/json"

SAMPLE_QUESTIONS='[{"order":1,"type":"text","label":"Name","required":true}]'

echo "=== 1. JWT: mint a connector token ==="
CREATE_TOKEN=$(curl -sS -X POST "$API/connector-tokens" \
  -H "$AUTH_JWT" -H "$JSON" \
  -d '{"name":"Claude test"}')
echo "$CREATE_TOKEN"

FM_TOKEN=$(node -e "const d=JSON.parse(process.argv[1]); process.stdout.write(d.data.token)" "$CREATE_TOKEN")
TOKEN_ID=$(curl -sS "$API/connector-tokens" -H "$AUTH_JWT" | node -e "
  let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>{
    const tokens=JSON.parse(s).data.tokens;
    process.stdout.write(String(tokens[0]._id));
  });
")
AUTH_FM="Authorization: Bearer $FM_TOKEN"
echo "fm_ token acquired"

echo "=== 2. Connector: list forms; create ignores publish; update cannot change status/author ==="
curl -sS -D - -o /tmp/forms-list.json "$API/forms" -H "$AUTH_FM" | head -n 1
cat /tmp/forms-list.json; echo

CREATE_BODY=$(cat <<EOF
{
  "title": "Claude draft",
  "description": "created via connector",
  "settings": { "status": "published", "restricted": true },
  "userarr": ["someone@example.com"],
  "questions": [{"order":1,"type":"text","label":"Name","required":true}]
}
EOF
)

CREATE_FORM=$(curl -sS -X POST "$API/forms" -H "$AUTH_FM" -H "$JSON" -d "$CREATE_BODY")
echo "$CREATE_FORM"

SLUG=$(node -e "const d=JSON.parse(process.argv[1]); process.stdout.write(d.data.formSlug)" "$CREATE_FORM")
STATUS=$(node -e "const d=JSON.parse(process.argv[1]); process.stdout.write(d.data.settings.status)" "$CREATE_FORM")
SOURCE=$(node -e "const d=JSON.parse(process.argv[1]); process.stdout.write(d.data.source)" "$CREATE_FORM")
RESTRICTED=$(node -e "const d=JSON.parse(process.argv[1]); process.stdout.write(String(d.data.settings.restricted))" "$CREATE_FORM")
echo "slug=$SLUG status=$STATUS source=$SOURCE restricted=$RESTRICTED"
# expect: status=draft source=claude restricted=false

echo "--- update with settings.published (must not publish) ---"
curl -sS -D - -o /tmp/upd-settings.json -X POST "$API/forms/$SLUG" \
  -H "$AUTH_FM" -H "$JSON" \
  -d '{"settings":{"status":"published"}}'
echo; cat /tmp/upd-settings.json; echo

echo "--- update with author overwrite (must not change author) ---"
curl -sS -D - -o /tmp/upd-author.json -X POST "$API/forms/$SLUG" \
  -H "$AUTH_FM" -H "$JSON" \
  -d '{"author":"000000000000000000000000"}'
echo; cat /tmp/upd-author.json; echo

echo "--- form after blocked updates (JWT read) ---"
curl -sS "$API/forms/$SLUG" -H "$AUTH_JWT"; echo

echo "=== 3. Connector must get 401 on privileged / account routes ==="
for req in \
  "DELETE $API/forms/$SLUG" \
  "PATCH $API/forms/$SLUG/resume-response" \
  "PATCH $API/forms/$SLUG/stop-response" \
  "POST $API/connector-tokens" \
  "GET $API/users/user"
do
  set -- $req
  echo "--- $1 $2 ---"
  curl -sS -D - -o /tmp/denied.json -X "$1" "$2" -H "$AUTH_FM" -H "$JSON" -d '{}'
  echo; cat /tmp/denied.json; echo
done

echo "=== 4. Free plan monthly limit (403 with plan message) ==="
# Already created 1 form above. Repeat until FREE_MONTHLY_FORMS (default 3).
for i in 2 3 4; do
  echo "--- create attempt $i ---"
  curl -sS -D - -o /tmp/limit.json -X POST "$API/forms" -H "$AUTH_FM" -H "$JSON" \
    -d "{\"title\":\"Limit $i\",\"questions\":$SAMPLE_QUESTIONS}"
  echo; cat /tmp/limit.json; echo
done
# The request that exceeds the limit should be HTTP 403 with:
# "Free plan limit reached: you can create 3 forms per month. Upgrade to create more."

echo "=== 5. JWT publish via resume-response, then anonymous GET is immediately 200 ==="
PUBLISH_SLUG="${PUBLISH_SLUG:-$SLUG}"
curl -sS -D - -o /tmp/resume.json -X PATCH "$API/forms/$PUBLISH_SLUG/resume-response" -H "$AUTH_JWT"
echo; cat /tmp/resume.json; echo

echo "--- anonymous GET (no Authorization) immediately after resume ---"
curl -sS -D - -o /tmp/public.json "$API/forms/$PUBLISH_SLUG"
echo; cat /tmp/public.json; echo
# expect HTTP 200 and settings.status published

echo "=== 6. Revoked connector token -> 401 ==="
curl -sS -D - -o /tmp/revoke.json -X DELETE "$API/connector-tokens/$TOKEN_ID" -H "$AUTH_JWT"
echo; cat /tmp/revoke.json; echo

curl -sS -D - -o /tmp/revoked-use.json "$API/forms" -H "$AUTH_FM"
echo; cat /tmp/revoked-use.json; echo
# expect HTTP 401 "Connector token is invalid or revoked"
```
