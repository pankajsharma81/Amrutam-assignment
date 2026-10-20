import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { Express } from 'express';

export const setupSwagger = (app: Express): void => {
    try {
        const swaggerDocument = YAML.load(
            path.join(__dirname, '../../docs/swagger.yaml')
        );
        app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
        console.log('📄 Swagger docs available at /api-docs');
    } catch {
        console.warn('⚠️  Swagger YAML not found — docs skipped');
    }
};
