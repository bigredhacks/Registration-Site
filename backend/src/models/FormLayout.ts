import mongoose from "mongoose";
const Schmea = mongoose.Schema;
import { FormStatus } from "../types/formStatus";
import { FormQuestionSchema } from "./FormQuestion";

export const FormLayoutSchema = new Schmea({
  title: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: FormStatus,
    default: FormStatus.OPEN,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  formQuestions: {
    type: [FormQuestionSchema],
  }

})

const FormLayoutModel = mongoose.model("FormLayout", FormLayoutSchema);

export default FormLayoutModel