import { argv } from 'node:process'
import * as path from 'path'
import { readdir, readFile } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'

const pages = path.join(argv.slice(2)[0], 'pages')

console.log(pages)

class Counter extends Map{
  get(key) {
    return super.get(key)
  }
  count(key){
    return super.set(key, (super.get(key) || 0) + 1)
  }
}

const extractItemText = (text) => {
  text.trim().replace(/[a-zA-Z0-9\+\/]{50,}/g,'')
             .replace(/<(.|\n)*?>/g, ' ')
             .replace(/\[((http|https|ftp):.*?) (.*?)\]/g, ' ')
             .split(/\s+/)
             .forEach((word) => words.count(word.toLowerCase()))
}

const extractStoryText = (story) => {
  story.forEach((item) => {
    if (Object.hasOwn(item, 'type')) {
      items.count(item.type)
    } else {
      items.count('type missing')
    }
    if (Object.hasOwn(item, 'text')) {
      extractItemText(item.text)
    }
  })
}

const words = new Counter()
const items = new Counter()

readdir(pages, { withFileTypes: true })
  .then((directroyListing) => {
    new Promise((resolve, reject) => {
      directroyListing.forEach((entry, index, array) => {
        if (entry.isFile()) {
          const filePath = path.join(entry.path, entry.name)
          readFile(filePath, { encoding: 'utf-8'})
            .then((raw) => {
              return JSON.parse(raw)
            })
            .then((page) => {
              try {
                if (Object.hasOwn(page, 'story')) {
                  const story = page.story
                  extractStoryText(story)
                }
              } catch (error) {
                console.log('problem with page', filePath, error, page)
              }
            })
            .finally(() => {
              if (index === array.length -1) resolve()
            })
          }
        })
      })
      .then(() => {
        console.log('Number of different item types:\t', items.size)
        console.log('Number of different words:\t', words.size)

        const itemStream = createWriteStream('items.txt')
        const freqItems = [...items.entries()].sort((a,b) => {
          if (a[1] < b[1]) {
            return 1
          } else if (a[1] > b[1]) {
            return -1
          }
          // same frequency so by alpha
          if (a[0] < b[0]) {
            return -1
          } else if (a[0] > b[0]) {
            return 1
          }
          return 0
        })
        freqItems.forEach((item) => {
          itemStream.write(item[1] + '\t' + item[0] + '\n')
        })
        itemStream.close()

        // report on words found - alphabetical list
        const wordStream = createWriteStream('words.txt')
        const sortedWords = [...words.keys()].sort()
        sortedWords.forEach((word) => {
          wordStream.write(word + '\n')
        })
        wordStream.close()

        // report on the length of words - longest first
        const lenStream = createWriteStream('length.txt')
        const lenWords = [...words.keys()].sort((a,b) => {
          if (a.length < b.length) {
            return 1
          } else if (a.length > b.length) {
            return -1
          }
          // same length so by alpha
          if (a.at(0) < b.at(0)) {
            return -1
          } else if (a.at(0) > b.at(0)) {
            return 1
          }
          return 0
        })
        lenWords.forEach((len) => {
          lenStream.write(len.length + '\t' + len + '\n')
        })
        lenStream.close()

        // report on word frequency
        const freqStream = createWriteStream('frequency.txt')
        const freqWords = [...words.entries()].sort((a,b) => {
          if (a[1] < b[1]) {
            return 1
          } else if (a[1] > b[1]) {
            return -1
          }
          // same frequency so by alpha
          if (a[0] < b[0]) {
            return -1
          } else if (a[0] > b[0]) {
            return 1
          }
          return 0
        })
        freqWords.forEach((freq) => {
          freqStream.write(freq[1] + '\t' + freq[0] + '\n')
        })
        freqStream.close()
      })
    })