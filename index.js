import { argv } from 'node:process'
import * as path from 'path'
import { readdir, readFile } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'

const pages = path.join(argv.slice(2)[0], 'pages')

let pageTitle = ''
let itemId = ''

console.log(pages)

class Counter extends Map{
  get(key) {
    return super.get(key)
  }
  count(key){
    // guard against null key
    if (key == null || key.length == 0) { 
      return
    }
    return super.set(key, (super.get(key) || 0) + 1)
  }
}

const extractItemText = (text) => {
  text.replace(/\[{2}|\[(?:[\S]+)|\]{1,2}/g,' ')                  // remove braces from any wiki links
      .replace(/\n/g, ' ')
      .replace(/<style.*?<\/style>/g, ' ') // remove any STYLE content
      .replace(/<(?:"[^"]*"['"]*|'[^']*'['"]*|[^'">])+>/g, ' ')   // remove HTML tags - fails if mismatched quotes!
      .replace(/<(?:[^>])+>/g, ' ')                               // remove any HTML tags - fails if embedded tags - in alt text!
      .replace(/\[([^\]]*?)\][\[\(].*?[\]\)]/g, ` ${2} `)         // remove markdown links
      .replace(/https?.*?(?=\p{White_Space}|$)/gu, ' ')           // remove any URLs                     
      .replace(/[\p{P}\p{Emoji}\p{Symbol}}]+/gu, ' ')             // remove all Punctuation, Emoji and Symbols
      .replace(/[\p{White_Space}\n\t]+/gu, ' ')
      .split(/\s+/)                                               // split - same a default tokenizer in minisearch
      //.filter((word) => word.match(/^[\p{Alphabetic}]*$/u))     // words must only contain letters
      .forEach((word) => {
        words.count(word.toLowerCase())
        if (word.length > 50) {
          console.log('long word', pageTitle, itemId, word)
        }
      })
}

const extractStoryText = (story) => {
  story.forEach((item) => {
    if (Object.hasOwn(item, 'type')) {
      items.count(item.type)
      itemId = item.id

      if (Object.hasOwn(item, 'text')) {
        switch (item.type) {
          case 'paragraph':
          case 'markdown':
          case 'html':
          case 'reference':
          case 'image':
          case 'pagefold':
          case 'math':
          case 'mathjax':
            extractItemText(item.text)
            break
          case 'audio':
          case 'video':
          case 'frame':
            // remove lines starting with UPPERCASE word or a URL
            extractItemText(item.text.split(/\r\n?|\n/)
                .map((line) => {
                  const firstWord = line.split(/\p{White_Space}/u)[0]
                  if (firstWord.startsWith('http') ||
                      firstWord.toUpperCase() === firstWord ||
                      firstWord.startsWith('//')) {
                    // line is markup
                    return ''
                  } else {
                    return line
                  }
                }).join(' '))
            break
          default:
            // other item types are not indexed.
        }      
      }
    } else {
      items.count('type missing')
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
                  pageTitle = page.title
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