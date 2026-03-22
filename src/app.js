require('dotenv').config();
const express = require('express');
const devopsRouter = require('./routes/devops');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'DevOps AI Tool' }));
app.use('/api/devops', devopsRouter);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`DevOps AI Tool running on port ${PORT}`));
}

module.exports = app;
