import FormLayoutModel from "../models/FormLayout";
import { Request, Response } from "express";
import { errorMessage, serverErrorMessage } from "../utils/resMessages";

export const getAllLayouts = async (req: Request, res: Response) => {
  try {
    const layouts = await FormLayoutModel.find(); // fetch all layouts
    res.status(200).json(layouts);
  } catch (err: any) {
    res.status(500).json(errorMessage(err)); 
  }
}

export const getLayoutById = async (req: Request, res: Response) => {
  try {
    const layout = await FormLayoutModel.findById(req.params.id); // fetch layout by id
    if (!layout) {
      res.status(404).json(errorMessage("Layout not found"));
      return
    }
    res.status(200).json(layout);
  } catch (err: any) {
    res.status(500).json(serverErrorMessage(err)); 
  }
}

export const createLayout = async (req: Request, res: Response) => {
  const { title, status, description, dueDate, formQuestions } = req.body;

  // validate request body
  if (!title || !status || !description || !dueDate || !formQuestions) {
    res.status(400).json(errorMessage("Missing required fields"));
    return
  }

  try {
    const layout = new FormLayoutModel(req.body); // create new layout
    await layout.save();
    res.status(201).json(layout);
  } catch (err: any) {
    res.status(500).json(serverErrorMessage(err));
  }
}

export const updateLayout = async (req: Request, res: Response) => {
    // Validate that request body only contains allowed fields
    const allowedFields = ["title", "status", "description", "dueDate", "formQuestions"];
    const isValidUpdate = Object.keys(req.body).every((key) => allowedFields.includes(key));

    if (!isValidUpdate) {
      res.status(400).json({ error: "Invalid update fields provided" });
      return
    }

  try {
    const layout = await FormLayoutModel.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }); 
    if (!layout) {
      res.status(404).json(errorMessage("Layout not found"));
      return
    }
    res.status(200).json(layout);
  } catch (err: any) {
    res.status(500).json(serverErrorMessage(err)); 
  }
}

export const deleteLayout = async (req: Request, res: Response) => {
  try {
    const deletedLayout = await FormLayoutModel.findByIdAndDelete(req.params.id); // delete layout by id
    if (!deletedLayout) {
      res.status(404).json(errorMessage("Layout not found"));
      return
    }
    res.status(200).json(deletedLayout);
  } catch (err) {
    res.status(500).json(serverErrorMessage(err));
  }
}



