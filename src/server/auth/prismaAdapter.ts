import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { PrismaClient, User as PrismaUser } from "@prisma/client";
import { Awaitable } from "next-auth";
import { Adapter } from "next-auth/adapters";




type TrimmedUser = Omit<PrismaUser, "id">;
type CreateUser = (user: PrismaUser) => Awaitable<TrimmedUser>;

const getCreateUser = (prisma: PrismaClient): CreateUser => {
    return (user: PrismaUser): Awaitable<TrimmedUser> => {
        //@ts-expect-error  //required because the Discord Provider assumes the standard user type from NextAuth core and returns the email properties, but we don't want to store emails in the database so Prisma will fail to create the user as it isn't expecting those properties. fixing this will probably require a custom provider.   //TODO!!!: create a follow-up issue to determine if we are receiving email info from Discord and discarding it or if we are not receiving it at all
        const { id, email, emailVerified, ...rest } = user;   //remove the discord id from the user object - a replacement is auto-generated by Prisma. also remove the undefined and undesired email properties
        const trimmedUser = rest as TrimmedUser;


        return prisma.user.create({
            data: trimmedUser,
        });
    };
};




export const customPrismaAdapter = (prisma: PrismaClient): Adapter => {
    const createUser = getCreateUser(prisma);

    return {
        ...PrismaAdapter(prisma),
        //@ts-expect-error  //required because Adapter expects the AdapterUser declared in NextAuth core, but we're using our own     //TODO?: figure out if this can be done with module augmentation
        createUser, //overwrite the createUser function
    };
};