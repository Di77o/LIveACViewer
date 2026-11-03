import { validateWallPlane, type WallPlane } from '../src/lib/wall-plane.js';

export type DetectedWall = {
  corners: WallPlane | null;
  confidence: 'low' | 'medium' | 'high';
  summary: string;
  warnings: string[];
};

export type Placement = {
  x: number;
  y: number;
  width: number;
  reasoning: string[];
  summary: string;
  confidence: 'low' | 'medium' | 'high';
  warnings: string[];
};

export type RecommendationRequest = {
  image: string;
  model: { name: string; widthMm: number; heightMm: number; depthMm?: number };
  wallWidthCm: number;
  wallCorners?: WallPlane;
  imageWidth?: number;
  imageHeight?: number;
};

export type PhotoRequest = {
  image: string;
  imageWidth?: number;
  imageHeight?: number;
};

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const numeric = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

const text = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;

export function validatePhoto(value: unknown, requireDimensions = false): PhotoRequest {
  const invalid = (message: string): never => {
    throw new ApiError(400, 'INVALID_REQUEST', message);
  };
  if (!object(value)) invalid('A photo is required.');
  const body = value as Record<string, unknown>;
  if (requireDimensions && (body.imageWidth === undefined || body.imageHeight === undefined)) {
    invalid('The photo width and height are required for wall detection.');
  }
  if ((body.imageWidth === undefined) !== (body.imageHeight === undefined)) {
    invalid('Both photo dimensions must be supplied together.');
  }
  if (body.imageWidth !== undefined && (!numeric(body.imageWidth, 100, 16000) || !numeric(body.imageHeight, 100, 16000))) {
    invalid('The photo dimensions are invalid.');
  }
  if (typeof body.image !== 'string' || body.image.length > 11_184_836) {
    invalid('Use a JPEG, PNG, or WebP photo smaller than 8 MB.');
  }
  const image = body.image as string;
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  if (!match || match[2]!.length % 4 !== 0) invalid('Use a JPEG, PNG, or WebP photo.');
  const [, mime, encoded] = match!;
  const bytes = Buffer.from(encoded!, 'base64');
  if (bytes.length < 12 || bytes.length > 8 * 1024 * 1024) invalid('Use a JPEG, PNG, or WebP photo smaller than 8 MB.');
  const actualMime = bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ? 'jpeg'
    : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'png'
    : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' ? 'webp'
    : null;
  if (mime !== actualMime) invalid('The photo format does not match its file contents. Please choose another photo.');
  return {
    image,
    ...(body.imageWidth === undefined ? {} : { imageWidth: body.imageWidth as number, imageHeight: body.imageHeight as number }),
  };
}

export function validateRequest(value: unknown): RecommendationRequest {
  const photo = validatePhoto(value);
  const invalid = (message: string): never => {
    throw new ApiError(400, 'INVALID_REQUEST', message);
  };
  const body = value as Record<string, unknown>;
  if (!object(body.model)) invalid('Choose an indoor unit before requesting a recommendation.');
  const model = body.model as Record<string, unknown>;
  if (!text(model.name, 160) || !numeric(model.widthMm, 200, 2000) || !numeric(model.heightMm, 100, 1200)) {
    invalid('The selected indoor unit has invalid dimensions.');
  }
  if (model.depthMm !== undefined && !numeric(model.depthMm, 30, 1000)) {
    invalid('The selected indoor unit has invalid dimensions.');
  }
  if (!numeric(body.wallWidthCm, 100, 2000)) invalid('Enter a wall width between 100 and 2000 cm.');
  if (body.wallCorners !== undefined && !validateWallPlane(body.wallCorners)) {
    invalid('Mark four valid wall corners in top-left, top-right, bottom-right, bottom-left order.');
  }
  return {
    ...photo,
    model: {
      name: (model.name as string).trim(),
      widthMm: model.widthMm as number,
      heightMm: model.heightMm as number,
      ...(model.depthMm === undefined ? {} : { depthMm: model.depthMm as number }),
    },
    wallWidthCm: body.wallWidthCm as number,
    ...(body.wallCorners === undefined ? {} : { wallCorners: body.wallCorners as WallPlane }),
  };
}

export function validatePlacement(value: unknown): Placement {
  const invalid = (): never => {
    throw new ApiError(502, 'INVALID_AI_RESPONSE', 'The AI returned an unusable placement. Please try another photo or adjust the position manually.');
  };
  if (!object(value)) invalid();
  const result = value as Record<string, unknown>;
  if (!numeric(result.x, 0, 1) || !numeric(result.y, 0, 1) || !numeric(result.width, 0.04, 0.75)) invalid();
  const x = result.x as number;
  const width = result.width as number;
  if (x - width / 2 < 0 || x + width / 2 > 1) invalid();
  if (!text(result.summary, 700) || !['low', 'medium', 'high'].includes(result.confidence as string)) invalid();
  for (const [field, min, max] of [['reasoning', 1, 5], ['warnings', 0, 5]] as const) {
    const list = result[field];
    if (!Array.isArray(list) || list.length < min || list.length > max || !list.every((item) => text(item, 600))) invalid();
  }
  return result as Placement;
}

export const placementSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    x: { type: 'number' },
    y: { type: 'number' },
    width: { type: 'number' },
    summary: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    reasoning: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['x', 'y', 'width', 'summary', 'confidence', 'reasoning', 'warnings'],
};

export function validateDetectedWall(value: unknown): DetectedWall {
  const invalid = (): never => {
    throw new ApiError(502, 'INVALID_AI_RESPONSE', 'The AI returned an unusable wall outline. Please try again or mark the wall corners manually.');
  };
  if (!object(value)) invalid();
  const result = value as Record<string, unknown>;
  if (result.corners !== null && !validateWallPlane(result.corners)) invalid();
  if (!['low', 'medium', 'high'].includes(result.confidence as string) || !text(result.summary, 700)) invalid();
  if (result.corners === null && result.confidence !== 'low') invalid();
  if (!Array.isArray(result.warnings) || result.warnings.length > 5 || !result.warnings.every((warning) => text(warning, 600))) invalid();
  return {
    corners: result.corners as WallPlane | null,
    confidence: result.confidence as DetectedWall['confidence'],
    summary: result.summary as string,
    warnings: result.warnings as string[],
  };
}

export const wallDetectionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    corners: {
      anyOf: [
        {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: { x: { type: 'number' }, y: { type: 'number' } },
            required: ['x', 'y'],
          },
        },
        { type: 'null' },
      ],
    },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    summary: { type: 'string' },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['corners', 'confidence', 'summary', 'warnings'],
};
