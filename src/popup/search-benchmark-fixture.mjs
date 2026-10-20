export function createSearchBenchmarkRecords(count) {
  const subjects = ['React', 'TypeScript', 'Rust', 'Python', 'Design', 'Docker', 'PostgreSQL', 'Kubernetes']
  const sections = ['Reference', 'Tutorial', 'Examples', 'Performance', 'Components', 'API', 'Testing']
  return Array.from({ length: count }, (_, index) => {
    const subject = subjects[index % subjects.length]
    const section = sections[Math.floor(index / subjects.length) % sections.length]
    const title = index % 11 === 0
      ? `前端开发 ${subject} ${section} ${index}`
      : `${subject} ${section} ${index}`
    const url = `https://${subject.toLowerCase()}.example.org/${section.toLowerCase()}/${index}`
    return {
      id: String(index), title, url, normalizedTitle: title.toLowerCase(),
      normalizedUrl: url.replace('https://', ''), displayUrl: url.replace('https://', ''),
      domain: `${subject.toLowerCase()}.example.org`, duplicateKey: url,
      path: `Bookmarks / ${subject}`, ancestorIds: ['1', subject],
      parentId: subject, index, dateAdded: 1700000000000 + index * 1000
    }
  })
}

export const SEARCH_BENCHMARK_QUERIES = [
  'react', 'type', 'rust', 'python api', 'react components', '前端',
  '前端 react', '"react reference"', 'kubernets', 'typscript',
  'site:react.example.org components', 'zqxvnonexistent', 'r', 'example',
  'qianduankaifa', 'qdkf',
  'raect components', 'typsc api', 'qianduankaif', '开发前端'
]
