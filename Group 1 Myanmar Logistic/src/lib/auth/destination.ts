import type {UserRole} from "@/types/domain";
export function profileDestination(profile:{role:UserRole;driver_access?:string}):string {
  if(profile.role==="driver"&&profile.driver_access==="disabled")return "/account/disabled";
  if(profile.role==="driver"&&profile.driver_access==="invited")return "/auth/driver-setup";
  return `/${profile.role}/dashboard`;
}
