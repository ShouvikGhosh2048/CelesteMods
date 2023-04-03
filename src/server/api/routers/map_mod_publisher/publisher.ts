import { z } from "zod";
import { createTRPCRouter, publicProcedure, adminProcedure, loggedInProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { MyPrismaClient } from "~/server/prisma";
import { Prisma, publisher } from "@prisma/client";
import { getCombinedSchema, getOrderObject } from "~/server/api/utils/sortOrderHelpers";
import { getNonEmptyArray } from "~/utils/getNonEmptyArray";
import { intMaxSizes } from "~/consts/integerSizes";
import { userIdSchema_NonObject } from "../user";
import axios from "axios";
import { ADMIN_PERMISSION_STRINGS, checkIsPrivileged } from "../../utils/permissions";




const defaultPublisherSelect = Prisma.validator<Prisma.publisherSelect>()({
    id: true,
    gamebananaId: true,
    userId: true,
    name: true,
});




export const PUBLISHER_NAME_MAX_LENGTH = 20;

const publisherNameSchema_NonObject = z.string().min(1).max(PUBLISHER_NAME_MAX_LENGTH);


export const publisherGamebananaIdSchema_NonObject = z.number().int().gte(1).lte(intMaxSizes.mediumInt.unsigned);

const publisherGamebananaIdSchema = z.object({
    gamebananaId: publisherGamebananaIdSchema_NonObject,
}).strict();


export const publisherIdSchema_NonObject = z.number().int().gte(1).lte(intMaxSizes.smallInt.unsigned);

const publisherIdSchema = z.object({
    id: publisherIdSchema_NonObject,
}).strict();


const publisherPostSchema = z.object({
    gamebananaId: publisherGamebananaIdSchema_NonObject,
    userId: userIdSchema_NonObject,
}).strict();


const publisherOrderSchema = getCombinedSchema(
    getNonEmptyArray(Prisma.PublisherScalarFieldEnum),
    ["name"],
    ["asc"],
);




const getPublisherByGamebananaId = async (prisma: MyPrismaClient, gamebananaId: number, throwOnMatch: boolean): Promise<void | Pick<publisher, keyof typeof defaultPublisherSelect>> => {
    const matchingPublisher: publisher | null = await prisma.publisher.findUnique({
        where: { gamebananaId: gamebananaId },
        select: defaultPublisherSelect,
    });


    if (throwOnMatch) {
        if (matchingPublisher) throw new TRPCError({
            message: `Conflicts with existing publisher ${matchingPublisher.id}`,
            code: "FORBIDDEN",
        });
    }
    else {
        if (!matchingPublisher) throw new TRPCError({
            message: `No publisher exists with gamebananaId "${gamebananaId}"`,
            code: "NOT_FOUND",
        });

        return matchingPublisher;
    }
}




const getPublisherById = async (prisma: MyPrismaClient, id: number): Promise<Pick<publisher, keyof typeof defaultPublisherSelect>> => {
    const publisher: publisher | null = await prisma.publisher.findUnique({  //having type declaration here AND in function signature is safer
        where: { id: id },
        select: defaultPublisherSelect,
    });

    if (!publisher) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: `No publisher exists with id "${id}"`,
        });
    }

    return publisher;
}




const getGamebananaUsernameById = async function (gamebananaID: number) {
    try {
        const options = {
            url: `https://api.gamebanana.com/Core/Member/IdentifyById?userid=${gamebananaID}`
        };

        const axiosResponse = await axios(options);

        if (axiosResponse.status != 200) {
            throw "GameBanana api not responding as expected.";
        }

        const gamebananaName = String(axiosResponse.data[0]);

        return gamebananaName;
    }
    catch (error) {
        throw new TRPCError({
            message: "Error getting gamebanana username.",
            code: "INTERNAL_SERVER_ERROR",
        });
    }
}




export const publisherRouter = createTRPCRouter({
    getAll: publicProcedure
        .input(publisherOrderSchema)
        .query(({ ctx, input }) => {
            return ctx.prisma.publisher.findMany({
                select: defaultPublisherSelect,
                orderBy: getOrderObject(input.selectors, input.directions),
            });
        }),

    getMany: publicProcedure
        .input(
            z.object({
                pageSize: z.number().int().min(1).max(100).default(50),
                pageNumber: z.number().int().min(1).default(1),
            }).strict().merge(publisherOrderSchema),
        )
        .query(async ({ ctx, input }) => {
            const { pageSize, pageNumber } = input;

            const numToSkip = pageSize * (pageNumber - 1);

            const publishers = await ctx.prisma.publisher.findMany({
                skip: numToSkip,
                take: pageSize,
                select: defaultPublisherSelect,
                orderBy: getOrderObject(input.selectors, input.directions),
            });

            return publishers;
        }),

    getById: publicProcedure
        .input(publisherIdSchema)
        .query(async ({ ctx, input }) => {
            return await getPublisherById(ctx.prisma, input.id);
        }),

    getByGamebananaId: publicProcedure
        .input(publisherGamebananaIdSchema)
        .query(async ({ ctx, input }) => {
            return await getPublisherByGamebananaId(ctx.prisma, input.gamebananaId, false);
        }),

    getByName: publicProcedure
        .input(
            z.object({
                query: publisherNameSchema_NonObject,
            }).strict().merge(publisherOrderSchema),
        )
        .query(async ({ ctx, input }) => {
            const publishers = await ctx.prisma.publisher.findMany({
                where: { name: { contains: input.query } },
                select: defaultPublisherSelect,
                orderBy: getOrderObject(input.selectors, input.directions),
            });

            return publishers;
        }),

    add: loggedInProcedure
        .input(publisherPostSchema)
        .mutation(async ({ ctx, input }) => {
            await getPublisherByGamebananaId(ctx.prisma, input.gamebananaId, true);     //check that the new publisher won't conflict with an existing one


            const gamebananaUsername = await getGamebananaUsernameById(input.gamebananaId);


            const publisher = await ctx.prisma.publisher.create({
                data: {
                    gamebananaId: input.gamebananaId,
                    name: gamebananaUsername,
                    user: { connect: { id: input.userId } },
                },
                select: defaultPublisherSelect,
            });


            return publisher;
        }),

    //Shouldn't actually be needed. GamebananaId should be set once and never changed. If it needs to be changed, it should be done by deleting the publisher and adding a new one.
    // editGamebananaId: loggedInProcedure
    //     .input(publisherGamebananaIdSchema.merge(publisherIdSchema))
    //     .mutation(async ({ ctx, input }) => {
    //         const publisherFromId = await getPublisherById(ctx.prisma, input.id);  //check that id matches an existing publisher

    //         checkIsPrivileged(ADMIN_PERMISSION_STRINGS, ctx.user, publisherFromId.userId ?? -1);  //check that the user is permitted to edit this publisher


    //         await getPublisherByGamebananaId(ctx.prisma, input.gamebananaId, true);     //check that the new publisher won't conflict with an existing one


    //         const gamebananaUsername = await getGamebananaUsernameById(input.gamebananaId);


    //         const publisher = await ctx.prisma.publisher.update({
    //             where: { id: input.id },
    //             data: {
    //                 gamebananaId: input.gamebananaId,
    //                 name: gamebananaUsername,
    //             },
    //             select: defaultPublisherSelect,
    //         });


    //         return publisher;
    //     }),

    claimPublisher: loggedInProcedure
        .input(publisherIdSchema)
        .mutation(async ({ ctx, input }) => {
            const publisherFromId = await getPublisherById(ctx.prisma, input.id);  //check that id matches an existing publisher

            if (publisherFromId.userId) {
                throw new TRPCError({
                    message: `Publisher "${input.id}" is already claimed by user "${publisherFromId.userId}".`,
                    code: "FORBIDDEN",
                });
            }


            const updatedPublisher = await ctx.prisma.publisher.update({
                where: { id: input.id },
                data: {
                    user: { connect: { id: ctx.user.id } },
                },
                select: defaultPublisherSelect,
            });


            return updatedPublisher;
        }),

    disownPublisher: loggedInProcedure
        .input(publisherIdSchema)
        .mutation(async ({ ctx, input }) => {
            const publisherFromId = await getPublisherById(ctx.prisma, input.id);  //check that id matches an existing publisher

            if (publisherFromId.userId != ctx.user.id) {
                throw new TRPCError({
                    message: `User "${ctx.user.id}" is not the owner of publisher "${input.id}".`,
                    code: "FORBIDDEN",
                });
            }


            const updatedPublisher = await ctx.prisma.publisher.update({
                where: { id: input.id },
                data: {
                    user: { disconnect: true },
                },
                select: defaultPublisherSelect,
            });


            return updatedPublisher;
        }),

    editConnectedUser: adminProcedure
        .input(z.object({
            userId: userIdSchema_NonObject,
        }).strict().merge(publisherIdSchema))
        .mutation(async ({ ctx, input }) => {
            await getPublisherById(ctx.prisma, input.id);  //check that id matches an existing publisher

            return await ctx.prisma.publisher.update({
                where: { id: input.id },
                data: {
                    user: { connect: { id: input.userId } },
                },
                select: defaultPublisherSelect,
            });
        }),

    delete: adminProcedure
        .input(publisherIdSchema)
        .mutation(async ({ ctx, input }) => {
            await getPublisherById(ctx.prisma, input.id);  //check that id matches an existing publisher

            //checkIsPrivileged(ADMIN_PERMISSION_STRINGS, ctx.user, publisherFromId.userId ?? -1);  //check that the user is permitted to edit this publisher

            await ctx.prisma.publisher.delete({ where: { id: input.id } });

            return true;
        }),
});