const express = require("express");
const mongoose = require("mongoose");
const Product = require("./Product");
const jwt = require("jsonwebtoken");
const amqp = require("amqplib");
const isAuthenticated = require("../isAuthenticated");
const app = express();
const PORT = process.env.PORT_ONE || 8080;
var order;

var channel, connection;

app.use(express.json());

// Connect to the database
mongoose
  .connect(
    "mongodb://localhost:27017/productService",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => {
    console.log("Database connection successful");
    app.listen(PORT, () => {
      console.log(
        `Server running on port http://localhost:${PORT}/`
      );
    });
  })
  .catch((error) => {
    console.log(error.message);
    process.exit(1);
  });

async function connect() {
  const amqpServer = "amqp://localhost:5672";
  connection = await amqp.connect(amqpServer);
  channel = await connection.createChannel();
  await channel.assertQueue("PRODUCT");
}
connect();

app.post(
  "/product/buy",
  isAuthenticated,
  async (req, res) => {
    const { ids } = req.body;
    const products = await Product.find({
      _id: { $in: ids },
    });
    channel.sendToQueue(
      "ORDER",
      Buffer.from(
        JSON.stringify({
          products,
          userEmail: req.user.email,
        })
      )
    );
    channel.consume("PRODUCT", (data) => {
      order = JSON.parse(data.content);
    });
    return res.json(order);
  }
);

app.post(
  "/product/create",
  isAuthenticated,
  async (req, res) => {
    const { name, description, price } = req.body;
    const newProduct = new Product({
      name,
      description,
      price,
    });
    newProduct.save();
    return res.json(newProduct);
  }
);
