import {z} from "zod";

export const driverInviteSchema=z.object({
  fullName:z.string().trim().min(2,"Enter your full name.").max(120,"Use 120 characters or fewer."),
  email:z.string().trim().toLowerCase().max(320).pipe(z.email("Enter a valid email address.")),
  phone:z.string().trim().max(40,"Use 40 characters or fewer.").regex(/^[+0-9()\s-]*$/,"Enter a valid phone number."),
});
export const driverPasswordSchema=z.object({password:z.string().min(10,"Use at least 10 characters.").max(128,"Use 128 characters or fewer."),confirmPassword:z.string()})
  .refine(value=>value.password===value.confirmPassword,{path:["confirmPassword"],message:"Your passwords do not match."});
export type DriverFormState={message?:string;success?:boolean;errors?:Partial<Record<"fullName"|"email"|"phone"|"password"|"confirmPassword",string[]>>};
