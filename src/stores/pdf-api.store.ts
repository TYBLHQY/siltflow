import { create } from "zustand"

interface PdfApiStore {
  thumbApi: {
    renderThumb: (pageIdx: number, dpr: number) => Promise<Blob | null>
    scrollTo: (pageIdx: number) => void
    totalPages: number
  } | null
  bookmarkApi: {
    getBookmarks: () => Promise<any[]>
  } | null
  setThumbApi: (api: PdfApiStore["thumbApi"]) => void
  setBookmarkApi: (api: PdfApiStore["bookmarkApi"]) => void
}

export const usePdfApiStore = create<PdfApiStore>((set) => ({
  thumbApi: null,
  bookmarkApi: null,
  setThumbApi: (thumbApi) => set({ thumbApi }),
  setBookmarkApi: (bookmarkApi) => set({ bookmarkApi }),
}))
