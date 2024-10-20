import { z } from "zod";




// this needs to be here to resolve webpack error in ~\src\server\api\routers\user_userClaim\userClaim.ts
export const userIdSchema_NonObject = z.string();   //TODO!!!: .cuid() doesn't work here, as sometimes a blank string is passed into trpc queries, which is not a valid cuid. Need to narrow this as much as possible without using .cuid().