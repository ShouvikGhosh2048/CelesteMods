import { type NextPage } from "next";
import { api } from "~/utils/api";
import { useMemo } from "react";
import { createStyles, Title } from "@mantine/core";
import { Difficulty, Mod, ModRatingData, ModYesRatingData, Quality } from "~/components/mods/types";
import { noRatingsFoundMessage } from "~/consts/noRatingsFoundMessage";
import { Layout } from "~/components/layout/layout";
import { ModsTable } from "~/components/mods/modsTable";
import type { ModWithInfo } from "~/components/mods/types";
import { MODS_PAGE_PATHNAME } from "~/consts/pathnames";




const useStyles = createStyles(
    () => ({
        pageTitle: {
            color: "white",
            fontSize: "35px",
            textAlign: "center",
        },
    }),
);




const getModWithInfo = (isLoading: boolean, mods: Mod[], ratingsFromModIds: ModRatingData[], qualities: Quality[], difficulties: Difficulty[]): ModWithInfo[] => {
    if (isLoading) return [];


    const modsWithInfo: ModWithInfo[] = mods.map((mod) => {
        const rating = ratingsFromModIds.find((rating) => rating.modId === mod.id);

        if (rating === undefined) throw `Mod ${mod.id} has an undefined rating - this should not happen.`;


        let overallCount = 0;
        let qualityId = -1;
        let qualityName: string;
        let qualityCount = 0;
        let difficultyId = -1;
        let difficultyName: string;
        let difficultyCount = 0;

        if ("overallCount" in rating === false) {   //no ratings exist for this map
            qualityName = noRatingsFoundMessage;
            difficultyName = noRatingsFoundMessage;
        } else {                                    //ratings exist for this map
            const narrowedRating = rating as ModYesRatingData;

            overallCount = narrowedRating.overallCount;
            qualityCount = narrowedRating.qualityCount;
            difficultyCount = narrowedRating.difficultyCount;

            if (narrowedRating.averageQualityId) qualityId = narrowedRating.averageQualityId;

            if (narrowedRating.averageDifficultyId) difficultyId = narrowedRating.averageDifficultyId;
        }


        if (qualityId === -1) qualityName = noRatingsFoundMessage;
        else {
            if (qualityCount === 0) throw `Quality count is 0 for mod ${mod.id} but qualityId is ${qualityId} (and not -1) - this should not happen.`;


            let quality = qualities.find((quality) => quality.id === qualityId);

            if (quality?.order === 1) quality = qualities.find((quality) => quality.order = 2);     //prevent mods from actually showing up as "Not Recommended"    //TODO: add minimum threshold below which the mod isn't displayed at all

            if (!quality) throw `Quality ${qualityId} not found. This should not happen.`;


            qualityName = quality.name;
        }


        if (difficultyId === -1) difficultyName = noRatingsFoundMessage;
        else {
            if (difficultyCount === 0) throw `Difficulty count is 0 for mod ${mod.id} but difficultyId is ${difficultyId} (and not -1) - this should not happen.`;


            const difficulty = difficulties.find((difficulty) => difficulty.id === difficultyId);

            if (!difficulty) throw `Difficulty ${difficultyId} not found. This should not happen.`;


            difficultyName = difficulty.name;
        }


        return {
            ...mod,
            overallCount,
            Quality: {
                id: qualityId,
                name: qualityName,
                count: qualityCount,
            },
            Difficulty: {
                id: difficultyId,
                name: difficultyName,
                count: difficultyCount,
            },
        };
    });


    return modsWithInfo;
};




const Mods: NextPage = () => {
    //get common data
    const qualityQuery = api.quality.getAll.useQuery({}, { queryKey: ["quality.getAll", {}] });
    const qualities = qualityQuery.data ?? [];


    const difficultyQuery = api.difficulty.getAll.useQuery({}, { queryKey: ["difficulty.getAll", {}] });
    const difficulties = difficultyQuery.data ?? [];


    /*
        //get all mod ids   //not using pagination because backend pagination is awkward with mantine-datatable     //TODO: implement this
        const modIdsQuery = api.mod.getIds.useQuery({}, { queryKey: ["mod.getIds", {}] });

        const isLoadingModIds = modIdsQuery.isLoading;

        const modIds = useMemo(() => {
            if (isLoadingModIds) return [];


            const modIds_maybeEmpty: number[] = modIdsQuery.data ?? [];

            if (!modIds_maybeEmpty.length) console.log(`modIds_maybeEmpty is empty. modIds = "${modIds}"`);


            return modIds_maybeEmpty;
        }, [isLoadingModIds, modIdsQuery.data]);


        //get mods data
        const modsQueries = api.useQueries(
            (useQueriesApi) => modIds.map(
                (id) => useQueriesApi.mod.getById(
                    {
                        id,
                        tableName: "Mod",
                    },
                    {
                        queryKey: [
                            "mod.getById",
                            { id, tableName: "Mod" },
                        ],
                    },
                ),
            ),
        );

        const isLoadingMods = isLoadingModIds || modsQueries.some((query) => query.isLoading);


        const mods = useMemo(() => {
            if (isLoadingMods) return [];


            const mods_maybeEmpty: Mod[] = [];

            modsQueries.forEach((modQuery) => {
                if (!modQuery.data) return;

                const mod = {
                    ...modQuery.data,
                    isExpanded: false,
                } as Mod;   //TODO!: prove this cast is safe

                if (mod) mods_maybeEmpty.push(mod);
            });

            if (!mods_maybeEmpty.length) console.log(`mods_maybeEmpty is empty. modIds = "${modIds}"`);


            return mods_maybeEmpty;
        }, [isLoadingMods, modsQueries]);
        */

    const modsQuery = api.mod.getAll.useQuery({}, { queryKey: ["mod.getAll", {}] });

    const isLoadingMods = modsQuery.isLoading;

    const mods = useMemo(() => {
        if (isLoadingMods || !modsQuery.data || !modsQuery.data.length) return [];


        const mods_maybeEmpty: Mod[] = [];

        modsQuery.data.forEach((mod) => {
            const modWithIsExpanded = {
                ...mod,
                isExpanded: false,
            };   //TODO!: prove this cast is safe

            mods_maybeEmpty.push(modWithIsExpanded);
        });

        if (!mods_maybeEmpty.length) console.log(`mods_maybeEmpty is empty.`);


        return mods_maybeEmpty;
    }, [isLoadingMods, modsQuery.data]);


    //get ratings data
    const ratingQueries = api.useQueries(
        (useQueriesApi) => mods.map(
            (mod) => useQueriesApi.rating.getModRatingData(
                { modId: mod.id },
                { queryKey: ["rating.getModRatingData", { modId: mod.id }] },
            ),
        ),
    );

    const isLoadingRatings = isLoadingMods || ratingQueries.some((query) => query.isLoading);

    const ratingsFromModIds = useMemo(() => {
        if (isLoadingRatings) return [];

        const ratings_maybeEmpty: ModRatingData[] = [];

        ratingQueries.forEach((ratingQuery) => {
            const rating = ratingQuery.data;

            if (rating !== undefined) ratings_maybeEmpty.push(rating);
        });

        if (!ratings_maybeEmpty.length) console.log(`ratings_maybeEmpty is empty. mods = "${JSON.stringify(mods)}"`);

        return ratings_maybeEmpty;
    }, [isLoadingRatings, ratingQueries, /*modIds,*/ mods]);  //TODO: figure out if modIds/mods can be removed from this dependency array


    //check that all data is loaded
    const isLoading = isLoadingMods || isLoadingRatings || qualityQuery.isLoading || difficultyQuery.isLoading;


    //get mods with map count, and quality and difficulty names
    const modsWithInfo = useMemo(() => {
        return getModWithInfo(isLoading, mods, ratingsFromModIds, qualities, difficulties);
    }, [isLoading, mods, ratingsFromModIds, qualities, difficulties]);


    const { classes } = useStyles();


    return (
        <Layout pageTitle="Mods" pageDescription="Mods" pathname={MODS_PAGE_PATHNAME}>
            <Title className={classes.pageTitle} order={2}>Mods List</Title>
            <ModsTable qualities={qualities} difficulties={difficulties} modsWithInfo={modsWithInfo} isLoading={isLoading} />
        </Layout>
    );
};

export default Mods;