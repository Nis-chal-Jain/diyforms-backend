import redis from "../db/redis.js";
import { Resend } from "resend";

const getResendClient = () => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        throw new Error("Missing RESEND_API_KEY environment variable.");
    }
    return new Resend(apiKey);
};

export const sendEmailOtp = async (email) => {
    const resend = getResendClient();

    const otp = Math.floor(
        100000 + Math.random() * 900000
    ).toString();

    // Store OTP for 5 minutes
    await redis.set(
        `emailOtp:${email}`,
        otp,
        "EX",
        300
    );

    const { data, error } = await resend.emails.send({
        from: `${process.env.EMAIL_CLIENT}`,
        to: email,
        subject: "Your OTP Code",
        html: `
            <h2>Your OTP Code</h2>
            <p>Your verification code is:</p>
            <h1>${otp}</h1>
            <p>This OTP expires in 5 minutes. Please don't share it with anyone.</p>
        `,
    });

    if (error) {
        console.log(error);
        throw new Error("Failed to send OTP email");
    }

    return data;
};