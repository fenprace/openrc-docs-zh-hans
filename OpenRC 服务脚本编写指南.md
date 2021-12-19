本文是《OpenRC Service Script Writing Guide》一文的中文翻译。

- 翻译状态：翻译中
- 最后翻译日期：2021-12-19
- 原文在翻译时状态：https://github.com/OpenRC/openrc/blob/32aeb7407bf5cdc354694b73f4c36376922f7c05/service-script-guide.md
- 原文当前状态：https://github.com/OpenRC/openrc/blob/master/service-script-guide.md
- 原文修改历史：https://github.com/OpenRC/openrc/commits/master/service-script-guide.md

# OpenRC 服务脚本编写指南

本文档的目标读者，是为了自己的项目或维护的软件包，而编写 OpenRC 服务脚本的开发者或打包者们。本文包含了各种建议、意见、提示、技巧、原则、警告和注意事项等。

本文旨在指出一些在实际编写 OpenRC 服务脚本中常见的错误，提供替代方案，以防止这些错误发生。每一个你应该做的要点，或不该做的错事，都有对应的章节。我们不考虑那些旁门左道，并假设你使用 start-stop-daemon 来管理一个典型的，长期运行的 UNIX 进程。

## 服务脚本格式

服务脚本都是 shell 脚本。出于可移植性考量，OpenRC 只使用标准的 POSIX sh 子集。默认的解释器（可以于构建 OpenRC 时调整）是 `/bin/sh`，所以使用 mksh 之类的解释器不会有问题。

OpenRC 已经于 busybox sh、ash、dash、bash、mksh、zsh 和其他的 shell 环境下测试。由于 busybox sh 使用内置功能替换了一些指令，但不提供等价的功能，使用 busybox sh 会带来一些困难。

服务脚本的解释器是 `#!/sbin/openrc-run`。不使用这个解释器会破坏依赖，OpenRC 不支持这种做法（换句话说，如果你坚持使用 `#!/bin/sh`，后果自负）。

`depend` 函数声明了服务脚本的依赖。所有脚本必须包含 start/stop/status 函数。OpenRC 提供了默认的 start/stop/status 函数，除非你有非常正当的原因，你都应该使用默认的 start/stop/status 函数。

可以简单地添加额外函数：

```
extra_commands="checkconfig"
checkconfig() {
	doSomething
}
```

这段代码导出了 checkconfig 函数，执行 `/etc/init.d/someservice checkconfig` 就会运行这个函数。

在 `extra_commands` 里定义的函数永远都可以使用，而在 `extra_started_commands` 里定义函数只能在服务启动后使用，在 `extra_stopped_commands` 里定义的函数只能在服务停止时使用。可以用这种方式实现优雅的重载服务或类似功能。

编写 restart 函数不会起作用，这是 OpenRC 的一个设计决策，因为重启服务可能会涉及依赖项的重启（比如 network -> apache）。restart 被映射为 `stop()` + `start()`（再加上处理依赖）。如果服务需要在重启时，做一些与正常启动或停止服务所不同的操作，应该测试 `$RC_CMD` 变量，比如：

```sh
[ "$RC_CMD" = restart ] && do_something
```

## depend 函数

这个函数声明了服务脚本的依赖，这将决定服务脚本启动的顺序。

```sh
depend() {
	need net
	use dns logger netmount
	want coolservice
}
```

`need` 声明了强依赖——net 总是需要在这个服务之前启动。

`use` 是一个软依赖——如果 dns、logger 或 netmount 在当前运行级别，在启动这个服务之前，先启动它们；但如果它们不在当前运行级别，就不管它们。

`want` 介于 need 和 use 之间——如果系统里安装了 coolservice，不管它是否在当前运行级别中，都尝试启动它，但我们不在乎它是否成功启动了。

`before` 声明本服务需要在一个服务之前启动。

`after` 声明本服务需要在另一个服务之后启动，但不创建依赖（所以服务停止是独立的）。

`provide` 允许多个服务提供同一个服务类型，比如：所有 cron 守护程序都定义了 `provide cron`，所以启动其中的一个就可以满足 cron 依赖。

`keyword` 允许服务在特定平台下改变行为，比如 `keyword -lxc` 可以让一个服务在 lxc 容器里无效化。这对于键盘映射或模块加载一类的服务很有用，因为这类服务要么是平台特定的，要么在容器或虚拟机等坏境下不可用。
