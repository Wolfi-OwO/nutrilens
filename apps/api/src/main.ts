import { createApplication } from './app/create-application.ts';

const port = Number(process.env.PORT ?? 8080);

const app = createApplication();

app.listen(port, () => {
    console.log(`apps/api listening on port ${port}`);
});
