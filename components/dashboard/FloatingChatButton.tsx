"use client";

import { useState } from "react";
import { MessageSquare, X, Minimize2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export function FloatingChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const params = useParams();
  const username = params?.username as string;

  return (
    <>
      {/* Floating Button */}
      <Link
        href={`/user/${username}/chat`}
        className="fixed bottom-6 right-6 z-50 group"
        title="AI Resume Chat"
      >
        <div className="relative">
          {/* Pulse animation ring */}
          <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-20" />
          
          {/* Main button */}
          <button className="relative w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group-hover:scale-110">
            <MessageSquare className="h-6 w-6" />
          </button>

          {/* Badge for new messages (optional, can be connected to state later) */}
          {/* <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white">
            3
          </div> */}
        </div>

        {/* Tooltip */}
        <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          AI Resume Chat
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
        </div>
      </Link>
    </>
  );
}
