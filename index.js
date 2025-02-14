require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const { compareAsc, compareDesc } = require("date-fns");

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
      origin: [
          "http://localhost:5173",
          "http://localhost:5174",
      ],
      credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gqz9f.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// JWT Token Credentials
const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
      return res.status(401).send({ error: 'Unauthorized access' });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
          return res.status(403).send({ error: 'Forbidden access' });
      }
      req.user = decoded;
      next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const foodCollection = client.db("foodSharing").collection("foods");
    const requestedFoodCollection = client.db("foodSharing").collection("requestFoods");

    // JWT post 
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5h' });

      res
          .cookie('token', token, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true })
  });

  // JWT token Logout 
  app.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    })
        .send({ success: true })
});

  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res)=>{
  res.send('Food Sharing Website is Okay!')
})

app.listen(port, ()=>{
  console.log(`Food Sharing website is running at: ${port}`)
})