const api = {
  request: loc => {
    return new Promise((resolve, reject) => {
      fetch('/api/'+loc)
        .then(res => res.json())
        .then(data => {
          resolve(data)
        })
        .catch(err => {
          reject(err)
        })
    })
  }
}

module.exports = api
