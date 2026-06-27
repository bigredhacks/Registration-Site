import 'dotenv/config';
import app from './app';

const PORT = process.env.PORT || 3000;

// Start server (local development / standalone hosting)
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
