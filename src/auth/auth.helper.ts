import { JWTHelper } from 'src/helpers/sdk';
import { config } from 'src/config';

export const jwtHelper = new JWTHelper(config.auth.JWT_SECRET);
