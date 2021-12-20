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

## 默认函数

所有服务脚本都须要包含以下函数：

```sh
start()
stop()
status()
```

OpenRC 提供了以上函数的默认实现，在 `lib/rc/sh/openrc-run.sh`——这样就可以写出十分精简的服务脚本。你可以在每个服务脚本中，按需求覆盖这些函数。

这些默认函数要求服务脚本中，必须有以下变量：

```sh
command=
command_args=
pidfile=
```

所以“最小”的服务脚本可以在 6 行内写下。

## 不要编写你自己的 start/stop 函数

基于你提供的信息，OpenRC 有能力启动或停止大多数守护进程。一个合格的守护进程应该可以默默地在后台运行，并创建自己的 PID 文件。对于这样的守护进程，你可能只需要提供这些变量给 OpenRC：

- command
- command_args
- pidfile

这些信息足够让 OpenRC 独立启动和停止守护进程了。下面这个例子来自 [OpenNTPD](www.openntpd.org) 的服务脚本：

```sh
command="/usr/sbin/ntpd"

# 这个特别的 RC_SVCNAME 变量包含了该服务的名称。
pidfile="/run/${RC_SVCNAME}.pid"
command_args="-p ${pidfile}"
```

如果守护进程默认在前台运行，但提供了使它后台运行并创建 PID 文件的选项，那么你还需要：

- command_args_background

这个变量应该包含让你的守护进程后台运行并创建 PID 文件的选项，下面的片段来自 [NRPE](https://github.com/NagiosEnterprises/nrpe) 的服务脚本：

```sh
command="/usr/bin/nrpe"
command_args="--config=/etc/nagios/nrpe.cfg"
command_args_background="--daemon"
pidfile="/run/${RC_SVCNAME}.pid"
```

因为 NRPE 默认以 _root_ 身份运行，不需要额外的授权就可以写入 `/run/nrpe.pid`。OpenRC 会以合适的参数启动和停止进程，甚至会在启动进程时传入 `--daemon` 选项让 NRPE 进入后台运行（NPRE 知道怎么创建自己的 PID 文件）。

但要是你的守护进程不是那么合格呢？要是它不会在后台运行，或者不会创建 PID 文件呢？如果它两者都做不到，就用：

- command_background=true

这会额外传递一个 `--make-pidfile` 选项给 start-stop-daemon，让 start-stop-daemon 为你创建 `$pidfile`（而不是把创建 PID 文件的任务交给守护进程）。

如果你的守护进程无法改变自身的用户或用户组，你可以告诉 start-stop-daemon 以非特权用户启动进程：

- command_user="user:group"

最后，如果你的守护进程可以启动到后台，但是无法创建 PID 文件，那你唯一的选择就是使用：

- procname

OpenRC 会利用 `procname`，通过比较运行中进程的名字，来查找你的守护进程，这样做并不是很可靠。不过你的守护进程本来就不应该只后台运行，而不创建 PID 文件。下面的例子是 [CA NetConsole Daemon](https://oss.oracle.com/) 服务脚本的一部分：

```sh
command="/usr/sbin/cancd"
command_args="-p ${CANCD_PORT}
              -l ${CANCD_LOG_DIR}
              -o ${CANCD_LOG_FORMAT}"
command_user="cancd"

# cancd 将自身守护进程化，但不创建 PID 文件，也不提供在前台运行的选项
# 所以在终止进程时，我们能做的，最多就是尝试以进程名称查找进程来终止它
procname="cancd"
```

回顾一下：

1. 如果进程在后台运行，并创建自己的 PID 文件，用 `pidfile`。
2. 如果进程不在后台运行（或者提供了让它在前台运行的选项），并且不创建 PID 文件，那就用 `command_background=true` 和 `pidfile`。
3. 如果进程在后台运行，但是不创建 PID 文件，用 `procname` 代替 `pidfile`，但如果你的进程提供了让它在前台运行的选项，那你应该让它在前台运行（然后按照上一点的方法处理它）。
4. 最后一种情况，尽管这样做没什么意义，你的进程不在后台运行但创建了 PID 文件。你应该禁用或无效化该进程的 PID 文件（或者把 PID 文件写入一个无用的路径），然后用 `command_background=true`。

## 重载守护进程的配置

许多守护进程都会响应信号来重载配置。假设你的进程接收到 `SIGHUP` 就重载配置，可以增加一个“reload”命令，来让你的服务脚本具有重载配置功能。首先，在服务脚本里声明这个命令。

```sh
extra_started_commands="reload"
```

我们用 `extra_started_commands` 而不是 `extra_commands`，因为“reload”只在进程运行时（也就是启动后）有效。现在可以用 start-stop-daemon 发送信号到对应的进程（假设你已经在服务脚本里定义了 `pidfile`）：

```sh
reload() {
  ebegin "Reloading ${RC_SVCNAME}"
  start-stop-daemon --signal HUP --pidfile "${pidfile}"
  eend $?
}
```

## 不要在配置损坏时重启 / 重载

这是一个十分常见的情景：用户启动了守护进程，修改配置文件，然后再尝试重启进程。如果修改后的配置文件有错误，会导致进程停止后不能再次启动（由于配置文件错误）。编写一个检查配置文件的函数，配合 `start_pre` 和 `stop_pre` 钩子，就可以预防这种情况发生。

```sh
checkconfig() {
  # 检查配置文件
}

start_pre() {
  # 如果不是重启，在启动进程前检查配置文件的有效性（相比盲目的启动进程，
  # 这样可以生成更好的错误信息）
  #
  # 反之，如果这 *是* 一次重启，那么 stop_pre 函数会确保配置文件可用，
  # 我们没必要再检查一遍。
  if [ "${RC_CMD}" != "restart" ] ; then
    checkconfig || return $?
  fi
}

stop_pre() {
  # 如果是重启，在停止进程前检查配置文件的有效性。
  if [ "${RC_CMD}" = "restart" ] ; then
      checkconfig || return $?
  fi
}
```

要防止 _重载_ 损坏的配置文件，很简单：

```sh
reload() {
  checkconfig || return $?
  ebegin "Reloading ${RC_SVCNAME}"
  start-stop-daemon --signal HUP --pidfile "${pidfile}"
  eend $?
}
```
