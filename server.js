require("marko/node-require") // Allow Node.js to require and load `.marko` files
 
const fsPromises = require("fs").promises
const path    = require("path")
const express = require("express")
const mime    = require("mime")
const markoExpress = require("marko/express")
const YAML    = require('yaml')

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
 
// Set up express app.
const app = express()
app.use(require("lasso/middleware").serveStatic())
app.use(markoExpress()) //enable res.marko(template, data)
 
// TODO: Move to separate file.
let getFileEntries = async (filepath, conf={}) => {
  conf = Object.assign({ directories: true }, conf)
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
  // Filter out directories if needed
  if (conf.directories === false) {
    files = files.filter(f => !f.isDirectory())
  }
  // Append '/' to directories.
  files = files.map(f => f.name+(f.isDirectory()?'/':''))

  return files
}

async function run() {

  let defaultSettings = {
    rootDirectory: path.resolve(__dirname),
  }
  let settingsFile = './settings.yml'
  let settings = {}
  try {
    settings = YAML.parse(await fsPromises.readFile(settingsFile, 'utf8'))
  } catch(e) {
    if (e.code === 'ENOENT') {
      await fsPromises.writeFile(settingsFile, YAML.stringify(defaultSettings))
    } else {
      throw e
    }
  }

  settings = Object.assign(defaultSettings, settings)

  let ensureMiddleware = (req, res, next) => {
    req.fullPathname = path.join(settings.rootDirectory, req.params[0])
    if (req.fullPathname.indexOf(settings.rootDirectory) !== 0) {
      res.statusCode = 403
      return res.send('naughty child\n')
    }
    next()
  }

  app.get("/api/*", ensureMiddleware, (req, res) => {
    getFileEntries(req.fullPathname).then(files => {
      res.send(JSON.stringify({
        entries: files,
      }))
    }).catch(err => {
      console.log(err)
      res.statusCode = 505
      res.send('err')
    })
  })
  
  app.get("*", ensureMiddleware, (req, res) => {
    let parsedPath = path.parse(req.fullPathname)
    let mimetype = mime.getType(parsedPath.ext)
    // Render image view if we're targetting a file.
    if (mimetype && mimetype.startsWith('image/')) {
      // Send image data if it is a raw request.
      if (req.query.raw !== undefined) {
        res.sendFile(req.fullPathname)
      // Otherwise render the image view.
      } else {
        getFileEntries(parsedPath.dir, {directories: false} ).then(files => {
          if (files.includes(parsedPath.base)) {
            res.marko(template, {
              route: path.relative(settings.rootDirectory, parsedPath.dir),
              entry: parsedPath.base,
              entries: files,
            })
          } else {
            res.statusCode = 404
            res.send('404')
          }
        }).catch(err => {
          res.statusCode = 505
          res.send('err')
        })
      }
    // Otherwise render the index.
    } else {
      getFileEntries(req.fullPathname).then(files => {
        res.marko(template, {
          route: path.relative(settings.rootDirectory, req.fullPathname),
          entries: files,
        })
      }).catch(err => {
        res.statusCode = 505
        res.send('err')
      })
    }
  })
   
  app.listen(8089)
}

run()
