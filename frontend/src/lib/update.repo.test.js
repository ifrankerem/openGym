import { describe, it, expect, vi, afterEach } from 'vitest'

// Which GitHub repository the update check asks (fork APK, issue #4): VITE_UPDATE_REPO
// when it is a non-empty `owner/name` string, else the upstream repository as today.
// Read at module load (a build-time define), so each case re-imports a fresh module
// after stubbing the env, the way the issue prescribes.
const DEFAULT_API = 'https://api.github.com/repos/DuarteSantos8/openGym/releases/latest'
const DEFAULT_PAGE = 'https://github.com/DuarteSantos8/openGym/releases/latest'
const FORK_API = 'https://api.github.com/repos/ifrankerem/openGym/releases/latest'
const FORK_PAGE = 'https://github.com/ifrankerem/openGym/releases/latest'

async function loadUpdate(repo) {
  vi.resetModules()
  vi.unstubAllEnvs()
  delete process.env.VITE_UPDATE_REPO
  if (repo !== undefined) vi.stubEnv('VITE_UPDATE_REPO', repo)
  const update = await import('./update.js')
  update.resetUpdateCheck()
  return update
}

function captureFetch() {
  const seen = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = vi.fn(url => {
    seen.push(url)
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ tag_name: 'v99.0.0', assets: [] }) })
  })
  return { seen, restore: () => { globalThis.fetch = originalFetch } }
}

describe('update repository override (VITE_UPDATE_REPO)', () => {
  afterEach(() => { vi.unstubAllEnvs() })

  it('without the variable, asks upstream as today', async () => {
    const update = await loadUpdate(undefined)
    expect(update.RELEASES_PAGE).toBe(DEFAULT_PAGE)
    const { seen, restore } = captureFetch()
    try {
      await update.checkForUpdate()
      expect(seen[0]).toBe(DEFAULT_API)
    } finally {
      restore()
    }
  })

  it('with the fork repository, asks the fork and links to it', async () => {
    const update = await loadUpdate('ifrankerem/openGym')
    expect(update.RELEASES_PAGE).toBe(FORK_PAGE)
    const { seen, restore } = captureFetch()
    try {
      await update.checkForUpdate()
      expect(seen[0]).toBe(FORK_API)
    } finally {
      restore()
    }
  })

  for (const bad of ['', 'nope', 'a/b/c', 'has space/x']) {
    it(`ignores a value that is not owner/name (${bad})`, async () => {
      const update = await loadUpdate(bad)
      expect(update.RELEASES_PAGE).toBe(DEFAULT_PAGE)
      const { seen, restore } = captureFetch()
      try {
        await update.checkForUpdate()
        expect(seen[0]).toBe(DEFAULT_API)
      } finally {
        restore()
      }
    })
  }
})
