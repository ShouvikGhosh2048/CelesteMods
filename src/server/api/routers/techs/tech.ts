import { z } from "zod";
import { createTRPCRouter, publicProcedure, adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { MyPrismaClient } from "~/server/prisma";
import { Prisma, tech } from "@prisma/client";
import { getCombinedSchema, getOrderObject } from "~/server/api/utils/sortOrderHelpers";
import { getNonEmptyArray } from "~/utils/getNonEmptyArray";
import { intMaxSizes } from "~/consts/integerSizes";
import { techVideoRouter, defaultTechVideoSelect, techVideoPostWithTechSchema } from "./techVideos";




const defaultTechSelect = Prisma.validator<Prisma.techSelect>()({
    id: true,
    name: true,
    description: true,
    difficultyId: true,
    tech_video: { select: defaultTechVideoSelect },
});




const techNameSchema_NonObject = z.string().min(1).max(50);


export const techIdSchema_NonObject = z.number().int().gte(1).lte(intMaxSizes.smallInt.unsigned);

const techIdSchema = z.object({
    id: techIdSchema_NonObject,
}).strict();


const techPostSchema = z.object({
    name: techNameSchema_NonObject,
    description: z.string().min(1).max(150).nullish(),
    difficultyId: techIdSchema_NonObject,
    techVideo: techVideoPostWithTechSchema.array(),
}).strict();


const techOrderSchema = getCombinedSchema(
    getNonEmptyArray(Prisma.TechScalarFieldEnum),
    ["difficultyId", "name"],
    ["asc"],
);




const validateTech = async (prisma: MyPrismaClient, newName?: string): Promise<void> => {
    if (!newName) return;

    const matchingTech = await prisma.tech.findUnique({ where: { name: newName } });

    if (matchingTech) throw new TRPCError({
        message: `Conflicts with existing tech ${matchingTech.id}`,
        code: "FORBIDDEN",
    });
}




//TODO: should accept getOrderObject
const getTechById = async (prisma: MyPrismaClient, id: number) => {
    const tech: tech | null = await prisma.tech.findUnique({    //having type declaration here AND in function signature is safer
        where: { id: id },
        select: defaultTechSelect,
    });

    if (!tech) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: `No tech exists with id "${id}"`,
        });
    }

    return tech;
}




export const techRouter = createTRPCRouter({
    getAll: publicProcedure
        .input(techOrderSchema)
        .query(({ ctx, input }) => {
            return ctx.prisma.tech.findMany({
                select: defaultTechSelect,
                orderBy: getOrderObject(input.selectors, input.directions),
            });
        }),

    getMany: publicProcedure
        .input(
            z.object({
                pageSize: z.number().int().min(1).max(100).default(50),
                pageNumber: z.number().int().min(1).default(1),
            }).strict().merge(techOrderSchema),
        )
        .query(async ({ ctx, input }) => {
            const { pageSize, pageNumber } = input;

            const numToSkip = pageSize * (pageNumber - 1);

            const techs = await ctx.prisma.tech.findMany({
                skip: numToSkip,
                take: pageSize,
                select: defaultTechSelect,
                orderBy: getOrderObject(input.selectors, input.directions),
            });

            return techs;
        }),

    getById: publicProcedure        //TODO: should accept getOrderObject
        .input(techIdSchema)
        .query(async ({ ctx, input }) => {
            return await getTechById(ctx.prisma, input.id);
        }),

    getByDifficultyId: publicProcedure
        .input(techIdSchema.merge(techOrderSchema))
        .query(async ({ ctx, input }) => {
            const techs = await ctx.prisma.tech.findMany({
                where: { difficultyId: input.id },
                select: defaultTechSelect,
                orderBy: getOrderObject(input.selectors, input.directions),
            });

            return techs;
        }),

    getByName: publicProcedure
        .input(
            z.object({
                query: techNameSchema_NonObject,
            }).strict().merge(techOrderSchema),
        )
        .query(async ({ ctx, input }) => {
            const techs = await ctx.prisma.tech.findMany({
                where: { name: { contains: input.query } },
                select: defaultTechSelect,
                orderBy: getOrderObject(input.selectors, input.directions),
            });

            return techs;
        }),

    add: adminProcedure
        .input(techPostSchema)
        .mutation(async ({ ctx, input }) => {
            await validateTech(ctx.prisma, input.name);     //check that the new tech won't conflict with an existing one

            const tech = await ctx.prisma.tech.create({
                data: {
                    name: input.name,
                    description: input.description,
                    difficulty: { connect: { id: input.difficultyId } },
                    tech_video: { createMany: { data: input.techVideo } },
                },
                select: defaultTechSelect,
            });

            return tech;
        }),

    edit: adminProcedure
        .input(techPostSchema.partial().merge(techIdSchema).omit({ techVideo: true }))
        .mutation(async ({ ctx, input }) => {
            await getTechById(ctx.prisma, input.id);  //check that id matches an existing difficulty
            await validateTech(ctx.prisma, input.name);     //check that the new difficulty won't conflict with an existing one

            if (!input.name) throw new TRPCError({
                message: "name is undefined, but it was already confirmed to be defined. Please contact an admin.",
                code: "INTERNAL_SERVER_ERROR",
            });

            const tech = await ctx.prisma.tech.create({
                data: {
                    name: input.name,
                    description: input.description,
                    difficulty: { connect: { id: input.difficultyId } },
                },
                select: defaultTechSelect,
            });

            return tech;
        }),

    delete: adminProcedure
        .input(techIdSchema)
        .mutation(async ({ ctx, input }) => {
            await getTechById(ctx.prisma, input.id);  //check that id matches an existing difficulty

            await ctx.prisma.tech.delete({ where: { id: input.id } });

            return true;
        }),


    techVideo: techVideoRouter,
});