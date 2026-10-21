import { z } from "zod";

export const signupSchema=z.object({
  fullName:z.string().trim().min(2,"Enter your full name.").max(120,"Use 120 characters or fewer."),
  email:z.string().trim().toLowerCase().max(320).pipe(z.email("Enter a valid email address.")),
  password:z.string().min(10,"Use at least 10 characters.").max(128,"Use 128 characters or fewer."),
  confirmPassword:z.string(),
}).refine(value=>value.password===value.confirmPassword,{path:["confirmPassword"],message:"Your passwords do not match."});

export type SignupState={
  message?:string;
  success?:boolean;
  errors?:Partial<Record<"fullName"|"email"|"password"|"confirmPassword",string[]>>;
};
