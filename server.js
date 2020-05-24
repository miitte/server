require("marko/node-require") // Allow Node.js to require and load `.marko` files
 
const fsPromises = require("fs").promises
const path    = require("path")
const express = require("express")
const mime    = require("mime")
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
 
// TODO: Replace this with settings read from a config file.
const cfg = {
  rootDirectory: path.resolve(__dirname),
}

// TODO: Move to separate file.
let getFileEntries = async filepath => {
  let files = await fsPromises.readdir(filepath, {withFileTypes: true})
  // Filter out hidden files.
  files = files.filter(f => f.name&&!f.name.startsWith('.'))
  // Filter out non-images.
  files = files.filter(f => {
    if (f.isFile()) {
      let mimetype = mime.getType(path.parse(f.name).ext)
      if (mimetype && mimetype.startsWith('image/')) {
        return true
      }
      return false
    }
    return true
  })
  // Append '/' to directories.
  files = files.map(f => f.name+(f.isDirectory()?'/':''))

  return files
}

app.get("/api/*", (req, res) => {
  let fullPathname = path.join(cfg.rootDirectory, req.params[0])
  if (fullPathname.indexOf(cfg.rootDirectory) !== 0) {
    res.statusCode = 403
    return res.send('naughty child\n')
  }

  getFileEntries(fullPathname).then(files => {
    res.send(JSON.stringify({
      entries: files,
    }))
  }).catch(err => {
    console.log(err)
    res.statusCode = 505
    res.send('err')
  })
})

app.get("*", (req, res) => {
  // Ensure the path does not break out of our rootDirectory.
  let fullPathname = path.join(cfg.rootDirectory, req.params[0])
  if (fullPathname.indexOf(cfg.rootDirectory) !== 0) {
    res.statusCode = 403
    return res.send('naughty child\n')
  }

  getFileEntries(fullPathname).then(files => {
    res.marko(template, {
      route: path.relative(cfg.rootDirectory, fullPathname),
      entries: files,
    })
  }).catch(err => {
    res.statusCode = 505
    res.send('err')
  })
})
 
app.listen(8089)
