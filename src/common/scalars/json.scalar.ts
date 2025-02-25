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
      throw new Error('Not sure how to parse object value');
    }
    return null;
  }
}
