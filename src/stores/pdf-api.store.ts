import { create } from "zustand"

interface PdfApiStore {
  thumbApi: {
    renderThumb: (pageIdx: number, dpr: number) => Promise<Blob | null>
    totalPages: number
  } | null
  bookmarkApi: {
    getBookmarks: () => Promise<any[]>
  } | null
  scrollApi: {
    scrollToPage: (pageIndex: number) => void
  } | null
  setThumbApi: (api: PdfApiStore["thumbApi"]) => void
  setBookmarkApi: (api: PdfApiStore["bookmarkApi"]) => void
  setScrollApi: (api: PdfApiStore["scrollApi"]) => void
}

export const usePdfApiStore = create<PdfApiStore>((set) => ({
  thumbApi: null,
  bookmarkApi: null,
  scrollApi: null,
  setThumbApi: (thumbApi) => set({ thumbApi }),
  setBookmarkApi: (bookmarkApi) => set({ bookmarkApi }),
  setScrollApi: (scrollApi) => set({ scrollApi }),
}))
