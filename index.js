import express from 'express';
import adminRoutes from './src/routes/adminRoutes.js';
import agentRoutes from './src/routes/agentRoutes.js';
import publicRoutes from './src/routes/publicRoutes.js';


const app = express();

const port = 3000;

app.use('/api/admin',adminRoutes);
app.use('/api/agent',agentRoutes);
app.use('/api/public',publicRoutes);


app.listen(port,()=>{
    console.log(`Server is running on port ${port}`);
})