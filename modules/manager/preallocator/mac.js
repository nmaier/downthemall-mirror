/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is DownThemAll preallocation ChromeWorker Worker_mac module.
 *
 * The Initial Developer of the Original Code is Nils Maier
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Nils Maier <MaierMan@web.de>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
"use strict";

var prealloc = (function() {
	var libc = ctypes.open("libSystem.dylib");
	if (!libc) {
		throw new Error("no libc");
	}

	const open = libc.declare(
		"open",
		ctypes.default_abi,
		ctypes.int, // retval
		ctypes.char.ptr, // path
		ctypes.int, // flags
		ctypes.uint32_t // mode_t mode
		);

	const closeFd = libc.declare(
		"close",
		ctypes.default_abi,
		ctypes.int, // retval
		ctypes.int // fd
		);

	const write = libc.declare(
		"write",
		ctypes.default_abi,
		ctypes.ssize_t, // retval
		ctypes.int, // fd
		ctypes.char.ptr, // buf
		ctypes.size_t // count
		);

	const ftruncate = libc.declare(
		"ftruncate",
		ctypes.default_abi,
		ctypes.int, // retval
		ctypes.int, // fd
		ctypes.int64_t // off64_t off
		);
	const lseek = libc.declare(
		"lseek",
		ctypes.default_abi,
		ctypes.int64_t, // retval
		ctypes.int, // fd
		ctypes.int64_t, // off64_t off
		ctypes.int // whence
		);

	return function prealloc_mac(file, size, perms, sparseOk) {
		var rv = false;
		try {
			let fd = open(
				file,
				0x1 | 0x200,
				perms
				);
			if (fd == -1) {
				throw new Error("Failed to open file");
			}
			try {
				ftruncate(fd, ctypes.Int64(size));
				if (sparseOk) {
					log("allocating sparse");
				}
				else {
					--size;
					for (;;) {
						// Get end of the file
						let current = lseek(fd, ctypes.Int64(0), 0x2);

						// See if we still need to preallocate
						let remainder = size - current;
						if (remainder <= 0) {
							break;
						}

						// Calculate next seek
						let seek = Math.min(remainder, 4096); // estimate: usually 4K on mac now
						lseek(fd, ctypes.Int64(seek), 0x1);
						if (write(fd, "a", 1) != 1) {
							throw new Error("Failed to write byte");
						}
					}
				}

				// all good
				rv = true;
			}
			finally {
				closeFd(fd);
			}
		}
		catch (ex) {
			log(ex);
		}
		return rv;
	};
})();
