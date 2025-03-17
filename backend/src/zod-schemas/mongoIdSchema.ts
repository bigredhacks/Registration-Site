import { isValidObjectId } from "mongoose"
import { z } from "zod"

export const mongoIdSchema = z.object({
  id: z.string().min(1).refine((val) => isValidObjectId(val), {
    message: "Invalid MongoDB ID",
  }), 
})

type MongoDbId = z.infer<typeof mongoIdSchema>

export default MongoDbId
