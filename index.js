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
          "http://localhost:5175",
          "https://b10a11-food.web.app",
          "https://b10a11-food.firebaseapp.com",
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

// get all Foods
app.get("/all-foods", async (req, res) => {
  const { available, search, sort } = req.query;
  
  let query = {};
  if (available) {
    query.status = "Available";
  }
  if (search) {
    query.foodName = { $regex: search, $options: "i" };
  }

  let sortQuery = {};
  if (sort === "asc") {
    sortQuery = { expireDate: 1 }; // Ascending order
  } else if (sort === "dsc") {
    sortQuery = { expireDate: -1 }; // Descending order
  }

  try {
    const foods = await foodCollection.find(query).sort(sortQuery).toArray();
    res.send(foods);
  } catch (error) {
    console.error("Error fetching foods:", error);
    res.status(500).send({ message: "Error fetching foods" });
  }
});


//get all food data from Database
app.get("/foods", async (req, res) => {
  const foods = await foodCollection.find().toArray();
  res.send(foods);
});

//get Featured food data databases by quantity
app.get("/featured-foods", async (req, res) => {
  const foods = await foodCollection
    .find({ status: "Available" })
    .sort({ foodQuantity: -1 })
    .limit(6)
    .toArray();
  res.send(foods);
});

// get requested food by login user email
app.get("/request-foods", verifyToken, async (req, res) => {
  const email = req.query.email;
  if (req.user.email !== email) {
    return res.status(403).send({ message: "Forbidden" });
  }
  const result = await requestedFoodCollection
    .find({ user_email: email })
    .toArray();
  res.send(result);
});

//get single food database use id
app.get("/all-foods/:id", verifyToken, async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await foodCollection.findOne(query);
  res.send(result);
});

// manage my foods by login email
app.get("/manage-my-foods", verifyToken, async (req, res) => {
  const email = req.query.email;
  if (req.user.email !== email) {
    return res.status(403).send({ message: "Forbidden" });
  }
  const query = { "donator.donatorEmail": email };
  const result = await foodCollection.find(query).sort({ _id: -1 }).toArray();
  res.send(result);
});


//post all add foods
app.post("/all-foods", verifyToken, async (req, res) => {
  const foods = req.body;
  const result = await foodCollection.insertOne(foods);
  res.send(result);
});


//post request foods
app.post("/request-foods", verifyToken, async (req, res) => {
  const foodRequest = req.body;
  if (req.user.email !== foodRequest.user_email) {
    return res.status(401).send({ message: "Unauthorized" });
  }
  const foodId = foodRequest.food_id;
  const result = await requestedFoodCollection.insertOne(foodRequest);
  const filter = { _id: new ObjectId(foodId) };
  const updateDoc = {
    $set: { status: foodRequest.status },
  };
  const updateResult = await foodCollection.updateOne(filter, updateDoc);
  res.send(result);
});


app.patch("/all-foods/:id", verifyToken, async (req, res) => {
  const { foodName, foodImg, foodQuantity, location, expireDate, additionalNotes } = req.body;
  const id = req.params.id;

  const filter = { _id: new ObjectId(id), "donator.donatorEmail": req.user.email };

  const updateDoc = {
    $set: { foodName, foodImg, foodQuantity, location, expireDate, additionalNotes },
  };

  const result = await foodCollection.updateOne(filter, updateDoc);
  res.send(result);
});


//delete all food databases
app.delete("/all-foods/:id", verifyToken, async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const result = await foodCollection.deleteOne(filter);
  res.send(result);
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