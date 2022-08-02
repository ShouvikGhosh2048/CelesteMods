import ajvModule from "ajv";
import { intMaxSizes } from "./integerSizes";

const ajv = new ajvModule();


const ratingPostSchema = {
    type: "object",
    properties: {
        mapID: {
            type: "integer",
            minimum: 1,
            maximum: intMaxSizes.mediumInt.unsigned,
        },
        quality: {
            type: "integer",
            minimum: 1,
            maximum: intMaxSizes.tinyInt.unsigned,
        },
        difficultyID: {
            type: "integer",
            minimum: 1,
            maximum: intMaxSizes.smallInt.unsigned,
        },
    },
    anyOf: [
        {
            properties: {
                quality: {
                    type: "integer",
                    minimum: 1,
                    maximum: intMaxSizes.tinyInt.unsigned,
                },
            },
            required: ["quality"],
        },
        {
            properties: {
                difficultyID: {
                    type: "integer",
                    minimum: 1,
                    maximum: intMaxSizes.smallInt.unsigned,
                },
            },
            required: ["difficultyID"],
        },
    ],
    additionalProperties: false,
    required: ["mapID"],
};


const ratingPatchSchema = {
    type: "object",
    properties: {
        quality: {
            type: "integer",
            minimum: 1,
            maximum: intMaxSizes.tinyInt.unsigned,
        },
        difficultyID: {
            type: "integer",
            minimum: 1,
            maximum: intMaxSizes.smallInt.unsigned,
        },
    },
    additionalProperties: false,
};


export const validateRatingPost = ajv.compile(ratingPostSchema);
export const validateRatingPatch = ajv.compile(ratingPatchSchema);