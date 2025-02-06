import mongoose from "mongoose";
const Schema = mongoose.Schema;
import { QuestionType } from "../types/questionType";

export const FormQuestionSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  required: {
    type: Boolean,
    default: false,
    required: true,
  },
  type:{
    type: String,
    enum: QuestionType,
    default: QuestionType.SHORT_TEXT,
  },
  defaultValue: {
    type: String,
  },
  options: {
    type: [String],
  },
  minLength: {
    type: Number,
  },
  maxLength: {
    type: Number,
  }
});

const FormQuestionModel = mongoose.model("FormQuestion", FormQuestionSchema);

export default FormQuestionModel;