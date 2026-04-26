import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import booksRouter from "./books.js";
import exportRouter from "./exportRoutes.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(booksRouter);
router.use(exportRouter);

export default router;
