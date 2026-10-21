import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(320).pipe(z.email("Enter a valid email address.")),
  password: z.string().min(1, "Enter your password.").max(128, "Password is too long."),
});

export type LoginState = {
  message?: string;
  errors?: { email?: string[]; password?: string[] };
};
