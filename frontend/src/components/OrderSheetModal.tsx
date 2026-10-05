import { Printer, Scale, X } from 'lucide-react';
import type { Mutation, Parcel, Session } from '../lib/types';
import { Button } from './ui';
import { shortDate } from '../lib/format';
import { printDocument, openPrintWindow } from '../lib/print';

interface Props {
  open: boolean;
  onClose: () => void;
  mutation: Mutation;
  parcel: Parcel;
  session: Session | null;
}

/** Official, printable AC (Land) judicial order sheet for a single mutation case. */
export default function OrderSheetModal({ open, onClose, mutation, parcel, session }: Props) {
  if (!open) return null;

  const docTitle = `Order-Sheet-${mutation.caseNumber}`;
  const isApproved = mutation.status === 'APPROVED';
  const isRejected = mutation.status === 'REJECTED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/70 p-4 backdrop-blur-sm print:p-0 print:bg-transparent">
      <div className="relative my-8 w-full max-w-2xl border border-line bg-sheet shadow-2xl print:my-0 print:border-0 print:shadow-none">
        <div className="flex items-center justify-between border-b border-line bg-ground px-6 py-3 print:hidden">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-indigo" />
            <span className="mono text-xs font-semibold uppercase text-ink">Judicial Order Sheet (আদেশনামা)</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="primary" onClick={() => printDocument('printable-order-sheet', docTitle)}>
              <Printer className="h-3.5 w-3.5" /> প্রিন্ট (Print PDF)
            </Button>
            <Button size="sm" onClick={() => openPrintWindow('printable-order-sheet', docTitle)}>
              নতুন ট্যাবে খুলুন
            </Button>
            <button onClick={onClose} className="rounded p-1 text-ink-3 transition-colors hover:bg-ground-sunk hover:text-ink" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div id="printable-order-sheet" className="p-6 sm:p-10 print:p-4 bg-white text-neutral-900 font-sans">
          <div className="text-center border-b-2 border-indigo-900 pb-4">
            <h2 className="text-base font-bold tracking-wide text-indigo-900">গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</h2>
            <h3 className="text-xs font-semibold text-neutral-700">সহকারী কমিশনার (ভূমি) এর কার্যালয় — {session?.office || parcel.upazila}</h3>
            <p className="mono mt-1 text-xs text-neutral-500">বিচারিক আদেশনামা (Judicial Order Sheet)</p>
          </div>

          <div
            className={`mt-5 rounded-md border p-3 text-center text-xs font-bold uppercase tracking-wider ${
              isApproved
                ? 'border-emerald-700 bg-emerald-50 text-emerald-900'
                : isRejected
                  ? 'border-red-700 bg-red-50 text-red-900'
                  : 'border-amber-700 bg-amber-50 text-amber-900'
            }`}
          >
            {mutation.status.replace(/_/g, ' ')}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div className="flex justify-between border-b border-neutral-100 py-1">
              <span className="text-neutral-500">মামলা নং:</span>
              <span className="mono font-bold text-neutral-900">{mutation.caseNumber}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-100 py-1">
              <span className="text-neutral-500">পার্সেল আইডি:</span>
              <span className="mono font-semibold text-neutral-900">{parcel.id}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-100 py-1">
              <span className="text-neutral-500">আবেদনকারী:</span>
              <span className="font-semibold text-neutral-900">{mutation.applicantName}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-100 py-1">
              <span className="text-neutral-500">প্রস্তাবিত মালিক:</span>
              <span className="font-semibold text-neutral-900">{mutation.proposedOwner}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-100 py-1">
              <span className="text-neutral-500">মৌজা ও দাগ:</span>
              <span className="font-medium text-neutral-900">{parcel.mouza}, দাগ {parcel.dagNo}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-100 py-1">
              <span className="text-neutral-500">খতিয়ান নং:</span>
              <span className="mono font-semibold text-neutral-900">{parcel.khatianNo}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-100 py-1">
              <span className="text-neutral-500">আদেশের তারিখ:</span>
              <span className="mono font-medium text-neutral-900">{shortDate(new Date().toISOString())}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-100 py-1">
              <span className="text-neutral-500">বর্তমান পর্যায়:</span>
              <span className="font-medium text-neutral-900">{mutation.currentStage}</span>
            </div>
          </div>

          <div className="mt-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 border-b border-neutral-300 pb-1 mb-2">
              আদেশনামা মন্তব্য (Order Remarks)
            </h4>
            <p className="text-xs text-neutral-700 whitespace-pre-wrap">
              {mutation.remarks || 'কোনো অতিরিক্ত মন্তব্য লিপিবদ্ধ করা হয়নি।'}
            </p>
          </div>

          <div className="mt-8 flex items-end justify-end border-t-2 border-neutral-300 pt-6">
            <div className="text-right text-xs">
              <div className="inline-block border-t border-neutral-400 pt-1 text-center">
                <p className="font-bold text-neutral-900">{session?.name || 'সহকারী কমিশনার (ভূমি)'}</p>
                <p className="text-[11px] text-neutral-600">সহকারী কমিশনার (ভূমি), নির্বাহী ম্যাজিস্ট্রেট</p>
                <p className="mono text-[10px] text-neutral-400">{session?.office || parcel.upazila}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
