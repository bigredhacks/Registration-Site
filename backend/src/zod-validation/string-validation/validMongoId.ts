import { z } from "zod";
import { isValidObjectId } from "mongoose";

export const validMongoId = z
  .string()
  .refine((val) => isValidObjectId(val), { message: "Invalid MongoDB ID" });

type ValidMongoId = z.infer<typeof validMongoId>;

export default ValidMongoId;