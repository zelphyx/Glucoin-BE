import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DailyTaskService } from './daily-task.service';
import {
  CreateTaskTemplateDto,
  UpdateTaskTemplateDto,
  CompleteTaskDto,
  CreateManualTaskDto,
} from './dto/daily-task.dto';

@ApiTags('Daily Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('daily-tasks')
export class DailyTaskController {
  constructor(private dailyTaskService: DailyTaskService) {}

  // ==================== TEMPLATES ====================

  @Post('templates')
  @ApiOperation({ summary: 'Create a new task template' })
  async createTemplate(
    @CurrentUser() user: any,
    @Body() dto: CreateTaskTemplateDto,
  ) {
    return this.dailyTaskService.createTemplate(user.id, dto);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get all task templates' })
  async getTemplates(@CurrentUser() user: any) {
    return this.dailyTaskService.getTemplates(user.id);
  }

  @Put('templates/:id')
  @ApiOperation({ summary: 'Update a task template' })
  async updateTemplate(
    @CurrentUser() user: any,
    @Param('id') templateId: string,
    @Body() dto: UpdateTaskTemplateDto,
  ) {
    return this.dailyTaskService.updateTemplate(user.id, templateId, dto);
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Delete a task template' })
  async deleteTemplate(
    @CurrentUser() user: any,
    @Param('id') templateId: string,
  ) {
    return this.dailyTaskService.deleteTemplate(user.id, templateId);
  }

  @Put('templates/:id/toggle')
  @ApiOperation({ summary: 'Toggle template active status' })
  async toggleTemplate(
    @CurrentUser() user: any,
    @Param('id') templateId: string,
    @Query('active') active: string,
  ) {
    return this.dailyTaskService.toggleTemplate(
      user.id,
      templateId,
      active === 'true',
    );
  }

  @Post('templates/setup-defaults')
  @ApiOperation({ summary: 'Setup default task templates for diabetes management' })
  async setupDefaults(@CurrentUser() user: any) {
    return this.dailyTaskService.setupDefaultTemplates(user.id);
  }

  // ==================== DAILY TASKS ====================

  @Get('today')
  @ApiOperation({ summary: 'Get today\'s tasks with progress' })
  async getTodayTasks(@CurrentUser() user: any) {
    return this.dailyTaskService.getTodayTasks(user.id);
  }

  @Get('by-date')
  @ApiOperation({ summary: 'Get tasks for a specific date' })
  @ApiQuery({ name: 'date', required: true, example: '2024-12-15' })
  async getTasksByDate(
    @CurrentUser() user: any,
    @Query('date') date: string,
  ) {
    return this.dailyTaskService.getTasksByDate(user.id, date);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Mark a task as completed' })
  async completeTask(
    @CurrentUser() user: any,
    @Param('id') taskId: string,
    @Body() dto: CompleteTaskDto,
  ) {
    return this.dailyTaskService.completeTask(user.id, taskId, dto);
  }

  @Post(':id/uncomplete')
  @ApiOperation({ summary: 'Unmark a task (set as not completed)' })
  async uncompleteTask(
    @CurrentUser() user: any,
    @Param('id') taskId: string,
  ) {
    return this.dailyTaskService.uncompleteTask(user.id, taskId);
  }

  @Post('manual')
  @ApiOperation({ summary: 'Create a manual/one-time task' })
  async createManualTask(
    @CurrentUser() user: any,
    @Body() dto: CreateManualTaskDto,
  ) {
    return this.dailyTaskService.createManualTask(user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a task' })
  async deleteTask(
    @CurrentUser() user: any,
    @Param('id') taskId: string,
  ) {
    return this.dailyTaskService.deleteTask(user.id, taskId);
  }

  // ==================== STATISTICS ====================

  @Get('stats/weekly')
  @ApiOperation({ summary: 'Get weekly progress statistics' })
  async getWeeklyProgress(@CurrentUser() user: any) {
    return this.dailyTaskService.getWeeklyProgress(user.id);
  }

  @Get('stats/streak')
  @ApiOperation({ summary: 'Get current streak (consecutive days with 100% completion)' })
  async getStreak(@CurrentUser() user: any) {
    return this.dailyTaskService.getStreak(user.id);
  }
}
