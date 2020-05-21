require("marko/node-require") // Allow Node.js to require and load `.marko` files
 
const express = require("express")
const markoExpress = require("marko/express")

const isProduction = process.env.NODE_ENV === "production";
 
// Configure lasso to control how JS/CSS/etc. is delivered to the browser
require("lasso").configure({
  plugins: [
    "lasso-marko" // Allow Marko templates to be compiled and transported to the browser
  ],
  outputDir: __dirname + "/static", // Place all generated JS/CSS/etc. files into the "static" dir
  bundlingEnabled: isProduction, // Only enable bundling in production
  minify: isProduction, // Only minify JS and CSS code in production
  fingerprintsEnabled: isProduction // Only add fingerprints to URLs in production
})

const template = require("./src/pages/index")
 
const app = express()
 
app.use(require("lasso/middleware").serveStatic())
app.use(markoExpress()) //enable res.marko(template, data)
 
app.get("/", (req, res) => {
  res.marko(template, {
    route: "/"
  })
})

app.get("*", (req, res) => {
  res.marko(template, {
    route: req.params[0],
  })
})
 
app.listen(8089)
