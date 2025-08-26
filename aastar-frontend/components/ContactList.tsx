"use client";

import { useState } from "react";
import { User, Contact } from "@/lib/types";
import { contactStorage, formatAddress } from "@/lib/storage";
import { UserPlus, Trash2, Send, Mail, Wallet } from "lucide-react";
import AddContactModal from "./AddContactModal";
import TransferModal from "./TransferModal";

interface ContactListProps {
  contacts: Contact[];
  onDelete: (contactId: string) => void;
  onTransfer: (contact: Contact) => void;
}

export default function ContactList({ contacts, onDelete, onTransfer }: ContactListProps) {
  const handleDeleteContact = (id: string) => {
    if (confirm("确定要删除这个联系人吗？")) {
      onDelete(id);
    }
  };

  const getContactDisplayInfo = (contact: Contact) => {
    if (contact.walletAddress) {
      return {
        icon: <Wallet className="h-4 w-4 text-blue-500" />,
        value: formatAddress(contact.walletAddress),
        type: "钱包地址",
      };
    } else if (contact.email) {
      return {
        icon: <Mail className="h-4 w-4 text-green-500" />,
        value: contact.email,
        type: "邮箱地址",
      };
    }
    return {
      icon: <UserPlus className="h-4 w-4 text-gray-500" />,
      value: "未知类型",
      type: "未知",
    };
  };

  if (contacts.length === 0) {
    return (
      <div className="card text-center py-12">
        <UserPlus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">暂无联系人</h3>
        <p className="text-gray-500 mb-4">通过钱包地址或邮箱添加联系人开始转账</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {contacts.map(contact => {
        const displayInfo = getContactDisplayInfo(contact);
        return (
          <div key={contact.id} className="card">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 mb-1">{contact.name}</h3>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  {displayInfo.icon}
                  <span className="truncate" title={displayInfo.value}>
                    {displayInfo.value}
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-1">{displayInfo.type}</div>
              </div>
              <div className="flex space-x-2 ml-4">
                <button
                  onClick={() => onTransfer(contact)}
                  className="text-primary-600 hover:text-primary-700 p-1"
                  title="转账"
                  disabled={!contact.walletAddress}
                >
                  <Send
                    className={`h-5 w-5 ${!contact.walletAddress ? "opacity-50 cursor-not-allowed" : ""}`}
                  />
                </button>
                <button
                  onClick={() => handleDeleteContact(contact.id)}
                  className="text-red-600 hover:text-red-700 p-1"
                  title="删除"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
            {contact.email && !contact.walletAddress && (
              <div className="mt-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                无法获取钱包地址，暂不支持转账
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
