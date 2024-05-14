import { Router } from "express";
import { authenticateRequest } from "../../middlewares/auth";
import {
  asyncHandler /*, validateRequest*/,
} from "../../middlewares/api-utils";
// import configSchema from "../schemas/config-schema";
import * as AchievementsController from "../controllers/achievements";
import { achievementsGet } from "../../middlewares/rate-limit";

const router = Router();

router.get(
  "/",
  achievementsGet,
  authenticateRequest(),
  asyncHandler(AchievementsController.getAchievements)
);

export default router;
