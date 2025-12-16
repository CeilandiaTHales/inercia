import { Worker } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

console.log('Starting Inércia Worker...');
console.log(`Connecting to Redis at ${REDIS_URL}`);

// Connection options for Redis
const connection = {
  url: REDIS_URL,
};

// Create a worker instance to process 'default' queue
const worker = new Worker('default', async (job) => {
  console.log(`Processing job ${job.id} of type ${job.name}`);
  
  try {
    switch (job.name) {
      case 'email':
        console.log(`Sending email to ${job.data.to}... (Simulated)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        break;
      case 'cleanup':
        console.log('Running database cleanup...');
        break;
      default:
        console.log(`Unknown job type: ${job.name}`);
    }
  } catch (error) {
    console.error(`Failed to process job ${job.id}:`, error);
    throw error;
  }
}, { 
  connection,
  concurrency: 5 // Process 5 jobs at a time
});

worker.on('completed', (job) => {
  console.log(`Job ${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
  console.log(`Job ${job?.id} has failed with ${err.message}`);
});

worker.on('ready', () => {
    console.log("Worker is ready and listening for jobs.");
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing worker');
  await worker.close();
});
