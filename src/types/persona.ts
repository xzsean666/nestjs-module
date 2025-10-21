import { registerEnumType } from '@nestjs/graphql';

export enum PersonaType {
  TELEGRAM = 'telegram',
  X = 'x',
}

registerEnumType(PersonaType, {
  name: 'PersonaType',
});
