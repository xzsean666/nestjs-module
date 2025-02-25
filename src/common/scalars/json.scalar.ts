import { CustomScalar, Scalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';

@Scalar('JSON', () => JSON)
export class JSONScalar implements CustomScalar<any, any> {
  description = 'JSON custom scalar type';

  parseValue(value: any) {
    return JSON.parse(value);
  }

  serialize(value: any) {
    return value;
  }

  parseLiteral(ast: ValueNode) {
    if (ast.kind === Kind.STRING) {
      return JSON.parse(ast.value);
    }
    if (ast.kind === Kind.OBJECT) {
      const value = {};
      ast.fields.forEach((field) => {
        value[field.name.value] = this.parseLiteral(field.value);
      });
      return value;
    }
    return null;
  }
}
