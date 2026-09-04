"use client"

import { Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export function TrashcanButton({
  hasDeleted,
  onClick,
}: {
  hasDeleted: boolean
  onClick: () => void
}) {
  return (
    <Button
      id="vex-category-trash"
      variant="ghost"
      className={`w-16 h-16 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
        hasDeleted ? "bg-red-500 text-white hover:bg-red-600" : "bg-red-500/20 text-red-500 hover:bg-red-500/30"
      }`}
      onClick={onClick}
    >
      <Trash2 className="h-6 w-6" />
      <span className="text-[10px] font-medium">{hasDeleted ? "View" : "Trash"}</span>
    </Button>
  )
}

export function DeletedBlocksModal({
  open,
  onClose,
  onRestore,
  onClear,
}: {
  open: boolean
  onClose: () => void
  onRestore: () => void
  onClear: () => void
}) {
  if (!open) return null
  return (
    <div
      id="vex-deleted-blocks-modal"
      className="fixed bg-white rounded-lg shadow-2xl border border-gray-300 overflow-hidden"
      style={{
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: 400,
        zIndex: 200,
      }}
    >
      <div className="bg-gradient-to-r from-red-600 to-red-500 text-white px-4 py-2 flex items-center justify-between">
        <span className="font-semibold text-sm">Deleted Blocks</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-white hover:bg-white/20"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="p-4">
        <p className="text-sm text-gray-600 mb-4">
          Your previously deleted blocks are stored here. You can restore them to the workspace.
        </p>
        <div className="flex gap-2">
          <Button className="flex-1 bg-green-500 hover:bg-green-600 text-white" onClick={onRestore}>
            Restore Blocks
          </Button>
          <Button variant="outline" className="flex-1 bg-transparent" onClick={onClear}>
            Clear Trash
          </Button>
        </div>
      </div>
    </div>
  )
}
