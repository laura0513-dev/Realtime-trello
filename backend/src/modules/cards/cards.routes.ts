import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { createCard, updateCard, moveCard, deleteCard } from './cards.controller';

export const cardsRouter = Router({ mergeParams: true });

cardsRouter.use(authenticate);

cardsRouter.post('/',           createCard);  // POST   /api/columns/:columnId/cards
cardsRouter.patch('/:id',       updateCard);  // PATCH  /api/cards/:id
cardsRouter.patch('/:id/move',  moveCard);    // PATCH  /api/cards/:id/move
cardsRouter.delete('/:id',      deleteCard);  // DELETE /api/cards/:id
