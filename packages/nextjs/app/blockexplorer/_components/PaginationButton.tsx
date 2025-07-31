import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/outline";

type PaginationButtonProps = {
  currentPage: number;
  totalItems: number;
  setCurrentPage: (page: number) => void;
  hasTransactions: boolean;
};

const ITEMS_PER_PAGE = 20;

export const PaginationButton = ({
  currentPage,
  totalItems,
  setCurrentPage,
  hasTransactions,
}: PaginationButtonProps) => {
  const isPrevButtonDisabled = currentPage === 0;
  const isNextButtonDisabled = !hasTransactions || currentPage + 1 >= Math.ceil(totalItems / ITEMS_PER_PAGE);
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  const prevButtonClass = isPrevButtonDisabled ? "btn-disabled cursor-default" : "btn-primary";
  const nextButtonClass = isNextButtonDisabled ? "btn-disabled cursor-default" : "btn-primary";

  // Don't show pagination if there are no transactions
  if (!hasTransactions || totalItems === 0) return null;

  return (
    <div className="mt-5 justify-end flex gap-3 mx-5">
      <button
        className={`btn btn-sm ${prevButtonClass}`}
        disabled={isPrevButtonDisabled}
        onClick={() => setCurrentPage(currentPage - 1)}
      >
        <ArrowLeftIcon className="h-4 w-4" />
      </button>
      <span className="self-center text-primary-content font-medium">
        Page {currentPage + 1} of {totalPages} ({totalItems} blocks with transactions)
      </span>
      <button
        className={`btn btn-sm ${nextButtonClass}`}
        disabled={isNextButtonDisabled}
        onClick={() => setCurrentPage(currentPage + 1)}
      >
        <ArrowRightIcon className="h-4 w-4" />
      </button>
    </div>
  );
};
